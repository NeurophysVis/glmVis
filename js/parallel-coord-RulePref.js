(function() {
  rulePref = {};
  var width, height,
      chart, svg,
      defs, style;

  // Set svg sizing and margins
  rulePref.init = function(params) {

    if (!params) {
      params = {};
    }

    chart = d3.select('#ruleInteractions-chart'); // placeholder div for svg
    var margin = {
      top: 30,
      right: 10,
      bottom: 30,
      left: 260
    },
          padding = {
            top: 60,
            right: 60,
            bottom: 60,
            left: 60
          };
    var outerWidth = params.width || 960,
        outerHeight = params.height || 500,
        innerWidth = outerWidth - margin.left - margin.right,
        innerHeight = outerHeight - margin.top - margin.bottom;
    var slider, timePeriods;

    width = innerWidth - padding.left - padding.right;
    height = innerHeight - padding.top - padding.bottom;

    chart.selectAll('svg')
          .data([{
            width: width + margin.left + margin.right,
            height: height + margin.top + margin.bottom
          }])
          .enter()
          .append('svg');
    svg = chart.select('svg').attr({
      width: function(d) {
        return d.width + margin.left + margin.right;
      },

      height: function(d) {
        return d.height + margin.top + margin.bottom;
      }
    })
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .attr('id', 'drawingArea');

    // rulePref.init can be re-ran to pass different height/width values
    // to the svg. this doesn't create new svg elements.
    style = svg.selectAll('style').data([{}]).enter()
        .append('style')
        .attr('type', 'text/css');

    // this is where we can insert style that will affect the svg directly.
    defs = svg.selectAll('defs').data([{}]).enter()
        .append('defs');

    // Create Marker for labeling
    defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('refX', 0)
        .attr('refY', 2)
        .attr('markerWidth', 6)
        .attr('markerHeight', 4)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M 0,0 V 4 L6,2 Z');

    // Load Data
    rulePref.loadData(params);
  };

  rulePref.loadData = function(params) {
    if (!params) {
      params = {};
    }

    // Apply style file (css) and embed in svg
    d3.text(params.style || 'css/parallel-coord.txt', function(error, txt) {
      // Embedded style file in the svg.
      style.text(txt);
      queue()
          .defer(d3.csv, 'DATA/Intertrial Interval norm_apc rule interactions.csv')
          .defer(d3.csv, 'DATA/Fixation norm_apc rule interactions.csv')
          .defer(d3.csv, 'DATA/Rule Stimulus norm_apc rule interactions.csv')
          .defer(d3.csv, 'DATA/Stimulus Response norm_apc rule interactions.csv')
          .defer(d3.csv, 'DATA/Saccade norm_apc rule interactions.csv')
          .defer(d3.csv, 'DATA/Reward norm_apc rule interactions.csv')
              .await(function(isError, Intertrial_Interval, Fixation, Rule_Stimulus, Stimulus_Response, Saccade, Reward) {
                // Draw visualization
                if (~isError) {
                  rulePref.data = {
                    Intertrial_Interval: Intertrial_Interval,
                    Fixation: Fixation,
                    Rule_Stimulus: Rule_Stimulus,
                    Stimulus_Response: Stimulus_Response,
                    Saccade: Saccade,
                    Reward: Reward
                  };
                  rulePref.draw(params);
                }
              });

    }); // End load style function

  };

  rulePref.draw = function(params, data) {
    var PLOTBUFFER = 30,
        line = d3.svg.line(), monkeySelector, timeSelector,
        xScale, yScale, dimColorScale, plotG, brushes = {}, toolTip,
        curMonkey = params.curMonkey || 'All';

    // Update Buttons
    monkeySelector = d3.selectAll('#monkeySelector');
    timeSelector = d3.selectAll('#intervalSelector');

    monkeySelector.selectAll('a').classed('selected', false);
    monkeySelector.selectAll('a#' + curMonkey).classed('selected', true);
    timeSelector.selectAll('a').classed('selected', false);
    timeSelector.selectAll('a#' + params.timePeriod).classed('selected', true);

    // Update window substring
    window.history.pushState({}, '', '/Parallel-Coordinates-APC/index.html?curMonkey=' + curMonkey +
                                                            '&timePeriod=' + params.timePeriod);

    // Tool Tip - make a hidden div to appear as a tooltip when mousing over a line
    toolTip = d3.select('body').selectAll('div.tooltip').data([{}]);
    toolTip.enter()
        .append('div')
          .attr('class', 'tooltip')
          .style('opacity', 1e-6);

    // Exclude neurons less than 1 Hz or not corresponding to the selected monkey
    var neurons = rulePref.data[params.timePeriod].filter(function(d) {
      var isMonkey = (d.Monkey == curMonkey) || (curMonkey == 'All');
      return isMonkey;
    });

    preProcess(neurons);
    setupScales(neurons);

    // Nest data by brain area
    neurons = d3.nest()
          .key(function(d) {
            return d.Brain_Area;
          })
          .sortKeys(d3.ascending)
          .entries(neurons);

    // Create brushes for all the dimensions
    rulePref.dimensions.map(function(dim) {
      brushes[dim] = d3.svg.brush()
          .x(xScale)
          .on('brush', brushed)
    });

    plotG = svg.selectAll('g.brainArea').data(neurons);
    plotG
        .enter()
        .append('g')
          .attr('transform', function(d, i) {
            return 'translate(' + ((width / 2) + PLOTBUFFER) * i + ', 0)';
          })
          .attr('class', 'brainArea')
          .attr('id', function(d) {
            return d.key;
          });

    plotG
        .each(drawParallel);

    monkeySelector.selectAll('a').on('click', function() {
      params.curMonkey = d3.select(this).property('id');
      rulePref.draw(params);
      mainEffects.draw(params);
    });

    timeSelector.selectAll('a').on('click', function() {
      params.timePeriod = d3.select(this).property('id');
      rulePref.draw(params);
      mainEffects.draw(params);
    });

    // Preprocess Data
    function preProcess(data) {

      var dimensionOrder = {
        Shortest: 'Preparation Time',
        Short: 'Preparation Time',
        Medium: 'Preparation Time',
        Long: 'Preparation Time',
        Longest: 'Preparation Time',
        Left: 'Response Direction',
        Right: 'Response Direction',
        Congruent: 'Current Congruency',
        Incongruent: 'Current Congruency',
        Previous_Congruent: 'Previous Congruency',
        Previous_Incongruent: 'Previous Congruency',
        Congruent: 'Current Congruency',
        Incongruent: 'Current Congruency',
        Repetition11plus: 'Rule Repetition',
        Repetition11plus: 'Rule Repetition',
        Repetition10: 'Rule Repetition',
        Repetition9: 'Rule Repetition',
        Repetition8: 'Rule Repetition',
        Repetition7: 'Rule Repetition',
        Repetition6: 'Rule Repetition',
        Repetition5: 'Rule Repetition',
        Repetition4: 'Rule Repetition',
        Repetition3: 'Rule Repetition',
        Repetition2: 'Rule Repetition',
        Repetition1: 'Rule Repetition',
        No_Previous_Error: 'Previous Error',
        Previous_Error: 'Previous Error',
        Overall: 'Rule'
      };

      // Extract plot dimensions
      var dimensions = d3.keys(dimensionOrder).filter(function(dim) {
        return d3.keys(data[0]).indexOf(dim) > -1;
      });

      rulePref.dimensions = dimensions;
      rulePref.dimensionOrder = dimensionOrder;
    }

    // Set up Scales
    function setupScales(data) {
      var xMin = -1;
      var xMax = 1;

      // Set xScale for each dimension
      xScale = d3.scale.linear()
          .domain([xMin, xMax])
          .range([0, (width - PLOTBUFFER) / 2]);

      yScale = d3.scale.ordinal()
          .domain(rulePref.dimensions)
          .rangePoints([height, 0], 1);

      dimColorScale = d3.scale.category10().domain(d3.values(rulePref.dimensionOrder).reverse());
    }

    // Draws parallel line plot
    function drawParallel(brainArea) {

      var curPlot = d3.select(this);
      var foreground, background, dimG, axisG, brushG,
          backLines, foreLines, title, zeroGroup, zeroLine,
          arrowData, arrowLine, arrowG, arrowEnter, orientLabel,
          colorLabel, xAxisLabel, solidAxis, overlay, overLines,
          overG, overCircle;

      // Add grey background lines for context.
      background = curPlot.selectAll('g.background')
          .data([{}]);
      background.enter()
          .append('g')
          .attr('class', 'background');
      backLines = background
          .selectAll('path')
                  .data(brainArea.values, function(d) {
                    return d.Name;
                  });

      backLines.exit()
          .transition()
          .duration(10)
          .ease('linear')
          .remove();
      backLines.enter()
          .append('path');

      // Line at Zero
      zeroData = [
          [
              [xScale(0), 0],
              [xScale(0), height]
          ]
      ];
      zeroGroup = curPlot.selectAll('g.zeroLine').data([{}]);
      zeroGroup.enter()
          .append('g')
          .attr('class', 'zeroLine');
      zeroLine = zeroGroup.selectAll('path').data(zeroData);
      zeroLine.enter()
          .append('path')
          .attr('stroke', 'black')
          .attr('stroke-width', '1px')
          .style('opacity', 0.9);
      zeroLine
          .attr('d', line);

      // Add a group element for each dimension.
      dims = curPlot.selectAll('g.dimensions').data([{}]);
      dims.enter()
          .append('g')
          .attr('class', 'dimensions');

      // Select dimensions group and bind to dimension data
      dimG = dims.selectAll('g.dimension')
          .data(rulePref.dimensions, String);

      // Remove dimension groups that don't currently exist
      dimG.exit()
          .transition()
          .duration(100)
          .style('opacity', 1E-6)
          .remove();

      // Append group elements to new dimensions
      dimG.enter()
          .append('g')
          .attr('class', 'dimension')
          .style('opacity', 1E-6);

      // Select axis and text for each dimension
      axisG = dimG.selectAll('g.grid').data(function(d) {
        return [d];
      }, String);

      // Append axis and text if it doesn't exist
      axisG.enter()
          .append('g')
            .attr('class', 'grid')
            .style('stroke-dasharray', ('3, 3'))
          .append('text')
            .style('text-anchor', 'end')
            .attr('x', -5)
            .attr('y', 3)
                    .text(function(dim) {
                      return (brainArea.key === 'dlPFC') ? '' : 'Rule @ ' + fixDimNames(dim);
                    })
                    .style('fill', function(d) {
                      return dimColorScale(rulePref.dimensionOrder[d]);
                    });

      // Call axis for each dimension
      axisG.each(function() {
        d3.select(this).call(d3.svg.axis()
            .scale(xScale)
            .tickSize(0, 0, 0)
            .orient('top')
            .ticks(0));
      });

      //Add and store a brush for each axis.
      brushG = dimG.selectAll('g.brush').data(function(d) {
        return [d];
      }, String);

      brushG.enter()
          .append('g')
          .attr('class', 'brush');
      brushG.each(function(dim) {
        d3.select(this).call(brushes[dim]);
      })
      .selectAll('rect')
      .attr('y', -8)
      .attr('height', 16);

      // Add blue foreground lines for focus.
      foreground = curPlot.selectAll('g.foreground').data([{}]);
      foreground.enter()
          .append('g')
          .attr('class', 'foreground')
          .style('opacity', 1E-6)
          .transition()
          .duration(1000)
          .style('opacity', 0.6);
      foreLines = foreground.selectAll('path')
                  .data(brainArea.values, function(d) {
                    return d.Name;
                  });

      foreLines.exit()
          .transition()
          .duration(500)
          .style('opacity', 1E-6)
          .remove();
      foreLines.enter()
          .append('path')
          .attr('id', function(d) {return d.Name;});

      // Overlay
      var overlay = curPlot.selectAll('g.overlay').data([{}]);
      overlay.enter()
          .append('g')
          .attr('class', 'overlay');
      var overG = overlay.selectAll('g')
                  .data(brainArea.values, function(d) {
                    return d.Name;
                  });

      overG.enter()
        .append('g')
          .attr('id', function(d) {return d.Name;})
          .style('display', 'none');
      var overCircle = overG.selectAll('circle').data(function(neuron) {
        return rulePref.dimensions.map(function(dim) {
          return {
            x: xScale(+neuron[dim]),
            dimension: dim,
            Session_Name: neuron.Session_Name,
            Name: neuron.Name
          };
        });
      });

      overCircle.enter()
        .append('circle')
          .attr('r', 3)
          .attr('fill', 'steelblue');
      overCircle.exit()
        .remove();
      var timeInterval = d3.select('#intervalSelector a.selected').property('id');
      var timeMap = [
        {timeInterval: 'Intertrial_Interval', cue: 'start_time'},
        {timeInterval: 'Fixation', cue: 'fixation_onset'},
        {timeInterval: 'Rule_Stimulus', cue: 'rule_onset'},
        {timeInterval: 'Stimulus_Response', cue: 'stim_onset'},
        {timeInterval: 'Saccade', cue: 'react_time'},
        {timeInterval: 'Reward', cue: 'reward_time'}
      ];
      var timeCue = timeMap.filter(function(d) {
                return d.timeInterval == timeInterval;
              });

      var pat = / /;
      overCircle.on('click', function(d) {
                window.location = '/RasterVis/index.html?' +
                    '&curNeuron=' + d.Name +
                    '&curTime=' + timeCue[0].cue +
                    '&curFactor=' + rulePref.dimensionOrder[d.dimension].replace(pat, '_') +
                    '&color=Rule';
              });

      // Transition back and fore lines at the same time to their current position
      d3.transition()
          .duration(1000)
          .ease('quad')
                  .each(function() {
                    backLines.transition()
                        .attr('d', path);
                    foreLines.transition()
                        .attr('d', path);
                    overCircle.transition()
                        .attr('cx', function(d) {return d.x;})
                        .attr('cy', function(d) {return yScale(d.dimension);})
                  })
                  .transition()
                  .duration(500)
                  .each(function() {
                    // Translate each dimension group to its place on the yaxis
                    dimG
                        .transition()
                          .attr('transform', function(d) {
                            return 'translate(0,' + yScale(d) + ')';
                          })
                          .style('opacity', 1);
                  });

      foreLines
          .on('mouseover', mouseover)
          .on('mouseout', mouseout)
          .on('click', mouseclick);

      // Axis with numbers
      solidAxis = curPlot.selectAll('g.axis').data([{}]);
      solidAxis.enter()
          .append('g')
          .attr('class', 'axis')
          .attr('transform', 'translate(0,0)')
      solidAxis
          .call(d3.svg.axis()
              .scale(xScale)
              .orient('top')
              .ticks(3)
              .tickSize(3, 0, 0)
          );
      drawLabels();

      // Labels
      function drawLabels() {
        // Lines with arrows
        arrowData = [{
          Name: 'Orient.',
          values: [
              [xScale(0) + 100, height + 7],
              [xScale(0) + 110, height + 7]
          ]
        }, {
          Name: 'Color',
          values: [
              [xScale(0) - 100, height + 7],
              [xScale(0) - 110, height + 7]
          ]
        }];
        arrowG = curPlot.selectAll('g.arrowLine').data([{}]);
        arrowG.enter()
            .append('g')
            .attr('class', 'arrowLine');
        arrowLine = arrowG.selectAll('path').data(arrowData);
        arrowEnter = arrowLine.enter()
            .append('path')
            .attr('stroke', 'black')
            .attr('stroke-width', '1.5px')
            .attr('marker-end', 'url(#arrowhead)');
        arrowLine
          .attr('d', function(d) {
            return line(d.values);
          });

        // Axis Labels
        colorLabel = curPlot.selectAll('text.colorLabel').data([{}]);
        colorLabel.enter()
            .append('text')
            .attr('class', 'colorLabel')
            .attr('x', xScale(0) - 10 + 'px')
            .attr('y', height + 7 + 'px')
            .attr('dy', 3 + 'px')
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .text('Higher Firing for');
        colorLabel.enter()
            .append('text')
            .attr('class', 'colorLabel')
            .attr('x', xScale(0) - 20 + 'px')
            .attr('y', height + 17 + 'px')
            .attr('dy', 3 + 'px')
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .text('Color Rule');
        orientLabel = curPlot.selectAll('text.orientLabel').data([{}]);
        orientLabel.enter()
            .append('text')
            .attr('class', 'orientLabel')
            .attr('x', xScale(0) + 10 + 'px')
            .attr('y', height + 7 + 'px')
            .attr('dy', 3 + 'px')
            .attr('text-anchor', 'start')
            .style('font-size', '12px')
            .text('Higher Firing for');
        orientLabel.enter()
            .append('text')
            .attr('class', 'orientLabel')
            .attr('x', xScale(0) + 20 + 'px')
            .attr('y', height + 17 + 'px')
            .attr('dy', 3 + 'px')
            .attr('text-anchor', 'start')
            .style('font-size', '12px')
            .text('Orient. Rule');
        xAxisLabel = curPlot.selectAll('text.xAxisLabel').data([{}]);
        xAxisLabel.enter()
          .append('text')
          .attr('class', 'xAxisLabel')
          .attr('x', xScale(0))
          .attr('y', -20)
          .attr('text-anchor', 'middle')
          .text('Norm. Firing Rate');

        // Title
        title = curPlot.selectAll('text.title').data([{}]);
        title.enter()
            .append('text')
            .attr('class', 'title')
            .attr('x', xScale(0))
            .attr('y', height + 50)
            .attr('text-anchor', 'middle')
            .style('font-size', '28px')
            .text(brainArea.key);
      }
    }

    // Returns the path for a given data point.
    function path(neuron) {
      return line(rulePref.dimensions.map(function(dim) {
        return [xScale(+neuron[dim]), yScale(dim)];
      }));
    }

    // Replaces underscores with blanks and 'plus' with '+'
    function fixDimNames(dimName) {
      var pat1 = /plus/,
          pat2 = /_/g,
          pat3 = /minus/;
      var fixedName = dimName.replace(pat1, '+').replace(pat2, ' ').replace(pat3, '-');
      return fixedName;
    }

    // Handles a brush event, toggling the display of foreground lines.
    function brushed() {
      // On brush, fade tool tip
      toolTip
          .style('opacity', 1e-6);

      // Get active dimension and their extents (min, max) in current plot
      var actives = rulePref.dimensions.filter(function(dim) {
        return !brushes[dim].empty();
      }),

          extents = actives.map(function(dim) {
            return brushes[dim].extent();
          });

      d3.selectAll('.foreground').selectAll('path').style('display', function(neuron) {
        return actives.every(function(activeDim, activeInd) {
          return extents[activeInd][0] <= neuron[activeDim] && neuron[activeDim] <= extents[activeInd][1];
        }) ? null : 'none';
      });

      // Select brushed neurons in main effects plot
      var activeNeuronsACC = d3.selectAll('#ruleInteractions-chart')
            .selectAll('#ACC')
            .selectAll('.foreground').selectAll('path')
            .filter(function() {
              return d3.select(this).style('display') == 'inline';
            }).data(),
          activeNeuronsDLPFC = d3.selectAll('#ruleInteractions-chart')
              .selectAll('#dlPFC')
              .selectAll('.foreground').selectAll('path')
              .filter(function() {
                return d3.select(this).style('display') == 'inline';
              }).data();
      activeNeurons = activeNeuronsACC.concat(activeNeuronsDLPFC);
      d3.selectAll('#mainEffects-chart').selectAll('.foreground').selectAll('path').style('display', function(neuron) {
        return activeNeurons.some(function(d) {
            return (d.Name == neuron.Name);
          }) ? null : 'none';
      });

      // Select brushed neurons in average firing rate histogram
      d3.selectAll('.foreground').selectAll('rect').style('display', function(rectData) {
        return (rectData.some(function(d) {
          return activeNeurons.some(function(e) {
            return d.Name == e.Name;
          })
        })) ? null : 'none';
      });

      d3.selectAll('.overlay').selectAll('g').style('display', 'none');
    }

    // On mouseover, highlight line, pop up tooltip
    function mouseover(d) {
      // Highlight line by increasing width and changing its color
      d3.select(this).classed('active', true);

      // Remove current line and reappend so that it appears on top
      var node = d3.select(this).node(),
          parent = node.parentNode;
      parent.appendChild(node);

      // Pop up tooltip
      toolTip
          .style('opacity', .9)
          .style('left', (d3.event.pageX + 40) + 'px')
          .style('top', (d3.event.pageY - 80) + 'px')
          .html(function() {
            return d.Brain_Area + ' Neuron ' + d.Wire_Number + '.' + d.Unit_Number + '<br>' +
                '<b>' + d.Session_Name + '</b><br>' +
                'Avg. Firing: ' + d.Average_Firing_Rate + ' Hz';
          });
    }

    // On mouseout, hide tooltip, un-highlight line
    function mouseout() {
      toolTip
          .style('opacity', 1e-6);
      d3.select(this).classed('active', false);
    }

    // On mouseclick
    function mouseclick(d) {
      d3.selectAll('.foreground').selectAll('path').style('display', function(neuron) {
        return (d.Name == neuron.Name) ? null : 'none';
      });

      d3.selectAll('.overlay').selectAll('g').style('display', function(neuron) {
        return (d.Name == neuron.Name) ? null : 'none';
      });

      // Select brushed neurons in average firing rate histogram
      d3.selectAll('.foreground').selectAll('rect').style('display', function(rectData) {
        return (rectData.some(function(e) {
          return d.Name == e.Name;
        })) ? null : 'none';
      });
    }
  }

})();
