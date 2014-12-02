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
        chart = d3.select(params.chart || "#chart"); // placeholder div for svg
        var margin = {
                top: 50,
                right: 10,
                bottom: 10,
                left: 150
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

        chart.selectAll("svg")
            .data([{
                width: width + margin.left + margin.right,
                height: height + margin.top + margin.bottom
            }])
            .enter()
            .append("svg");
        svg = d3.select("svg").attr({
                width: function(d) {
                    return d.width + margin.left + margin.right;
                },
                height: function(d) {
                    return d.height + margin.top + margin.bottom;
                }
            })
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
            .attr("id", "drawingArea");

        // rulePref.init can be re-ran to pass different height/width values
        // to the svg. this doesn't create new svg elements.
        style = svg.selectAll("style").data([{}]).enter()
            .append("style")
            .attr("type", "text/css");

        // this is where we can insert style that will affect the svg directly.
        defs = svg.selectAll("defs").data([{}]).enter()
            .append("defs");
        // Create Marker for labeling
        defs.append("marker")
            .attr("id", "arrowhead")
            .attr("refX", 0)
            .attr("refY", 2)
            .attr("markerWidth", 6)
            .attr("markerHeight", 4)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M 0,0 V 4 L6,2 Z");

        // Load Data
        rulePref.loadData(params);
    };
    rulePref.loadData = function(params) {
        if (!params) {
            params = {};
        }
        // Apply style file (css) and embed in svg
        d3.text(params.style || "css/parallel-coord.txt", function(error, txt) {
            // Embedded style file in the svg.
            style.text(txt);
            // ("#" + Math.random()) makes sure the script loads the file each time instead of using a cached version, remove once live
            var curFile = "DATA/" + params.data + ".csv" + "#" + Math.random();
            // Load csv data
            d3.csv(curFile, function(error, csv) {

                rulePref.data = preProcess(csv); // copy to globally accessible object
                // Draw visualization
                rulePref.draw(params);
            }); // end csv loading function
        }); // End load style function

        // Preprocess Data
        function preProcess(data) {

            var dimensionOrder = {
                minus1_Std_Dev_of_Prep_Time: "Normalized Prep Time",
                plus1_Std_Dev_of_Prep_Time: "Normalized Prep Time",
                Congruent: "Current Congruency",
                Incongruent: "Current Congruency",
                Previous_Congruent: "Previous Congruency",
                Previous_Incongruent: "Previous Congruency",
                Repetition11plus: "Switch History",
                Repetition11plus: "Switch History",
                Repetition10: "Switch History",
                Repetition9: "Switch History",
                Repetition8: "Switch History",
                Repetition7: "Switch History",
                Repetition6: "Switch History",
                Repetition5: "Switch History",
                Repetition4: "Switch History",
                Repetition3: "Switch History",
                Repetition2: "Switch History",
                Repetition1: "Switch History",
                No_Previous_Error: "Error History",
                Previous_Error: "Error History",
                Overall: "Overall"
            };
            // Extract plot dimensions
            var dimensions = d3.keys(dimensionOrder).filter(function(dim) {
                return d3.keys(data[0]).indexOf(dim) > -1;
            });

            // // Formatting function for normalized firing rate
            // var formatting = d3.format(".3g");
            //
            // // Normalize Firing Rates
            // data.map(function(neuron, neuronInd) {
            //     dimensions.map(function(dim) {
            //         var value = +neuron[dim] / +neuron["Average_Firing_Rate"];
            //         if (Math.abs(value) < 1E-3 || Math.abs(value) === Infinity || isNaN(value)) {
            //             value = 0.00;
            //         }
            //         data[neuronInd][dim] = formatting(value);
            //     });
            // });

            rulePref.dimensions = dimensions;
            rulePref.dimensionOrder = dimensionOrder;
            return data;

        }
    };
    rulePref.draw = function(params) {
        var PLOTBUFFER = 100,
            line = d3.svg.line(),
            curMonkey = d3.selectAll("#monkeySelector").selectAll(".selected").property("id"),
            xScale, yScale, dimColorScale, plotG, brushes = {}, toolTip;

        // Tool Tip - make a hidden div to appear as a tooltip when mousing over a line
        toolTip = d3.select("body").selectAll("div.tooltip").data([{}]);
        toolTip
            .enter()
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 1e-6);
        // Exclude neurons less than 1 Hz or not corresponding to the selected monkey
        var neurons = rulePref.data.filter(function(d) {
            var isMonkey = (d["Monkey"] == curMonkey) || (curMonkey == "All");
            return isMonkey;
        });

        setupScales(neurons);

        // Nest data by brain area
        neurons = d3.nest()
            .key(function(d) {
                return d["Brain_Area"];
            })
            .sortKeys(d3.ascending)
            .entries(neurons);

        // Create brushes for all the dimensions
        rulePref.dimensions.map(function(dim) {
            brushes[dim] = d3.svg.brush()
                .x(xScale)
                .on("brush", brushed)
        });

        plotG = svg.selectAll("g.brainArea").data(neurons);
        plotG
            .enter()
            .append("g")
            .attr("transform", function(d, i) {
                return "translate(" + ((width / 2) + PLOTBUFFER) * i + ", 0)";
            })
            .attr("class", "brainArea")
            .attr("id", function(d) {
                return d.key;
            });

        plotG
            .each(drawParallel);

        d3.selectAll("#monkeySelector").selectAll("a").on("click", function() {
            d3.selectAll("#monkeySelector").selectAll("a").classed("selected", false);
            d3.select(this).classed("selected", true);
            rulePref.draw(params)
        });
        d3.selectAll("#intervalSelector").selectAll("a").on("click", function() {
            d3.selectAll("#intervalSelector").selectAll("a").classed("selected", false);
            d3.select(this).classed("selected", true);
            params.data = d3.select(this).property("id") + " norm_apc";
            rulePref.loadData(params);
        });

        // Set up Scales
        function setupScales(data) {
                var xMin = -1, xMax = 1;

                // // Set xScale domain and range by looping over each data dimension and getting its max and min
                // xMin = d3.min(rulePref.dimensions.map(function(dim) {
                //     return d3.min(data, function(neuron) {
                //         return +neuron[dim];
                //     });
                // }));
                //
                // xMax = d3.max(rulePref.dimensions.map(function(dim) {
                //     return d3.max(data, function(neuron) {
                //         return +neuron[dim];
                //     });
                // }));
                //
                // // Make the max and min of the scale symmetric
                // if (Math.abs(xMin) > Math.abs(xMax)) {
                //     xMax = Math.abs(xMin);
                // } else if (Math.abs(xMin) < Math.abs(xMax)) {
                //     xMin = -1 * Math.abs(xMax);
                // };

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
                    colorLabel, xAxisLabel;

                // Add grey background lines for context.
                background = curPlot.selectAll("g.background")
                    .data([{}]);
                background.enter()
                    .append("g")
                    .attr("class", "background");
                backLines = background
                    .selectAll("path")
                    .data(brainArea.values, function(d) {
                        return d.Name;
                    });
                backLines.exit()
                    .transition()
                    .duration(10)
                    .ease("linear")
                    .remove();
                backLines.enter()
                    .append("path");
                // Line at Zero
                zeroData = [
                    [
                        [xScale(0), 0],
                        [xScale(0), height]
                    ]
                ];
                zeroGroup = curPlot.selectAll("g.zeroLine").data([{}]);
                zeroGroup.enter()
                    .append("g")
                    .attr("class", "zeroLine");
                zeroLine = zeroGroup.selectAll("path").data(zeroData);
                zeroLine.enter()
                    .append("path")
                    .attr("stroke", "black")
                    .attr("stroke-width", "1px")
                    .style("opacity", 0.9);
                zeroLine
                    .attr("d", line);
                // Add a group element for each dimension.
                dims = curPlot.selectAll("g.dimensions").data([{}]);
                dims.enter()
                    .append("g")
                    .attr("class", "dimensions");
                // Select dimensions group and bind to dimension data
                dimG = dims.selectAll("g.dimension")
                    .data(rulePref.dimensions, String);
                // Remove dimension groups that don't currently exist
                dimG.exit()
                    .transition()
                    .duration(100)
                    .style("opacity", 1E-6)
                    .remove();
                // Append group elements to new dimensions
                dimG.enter()
                    .append("g")
                    .attr("class", "dimension")
                    .style("opacity", 1E-6);
                // Select axis and text for each dimension
                axisG = dimG.selectAll("g.grid").data(function(d) {
                    return [d];
                }, String);
                // Append axis and text if it doesn't exist
                axisG.enter()
                    .append("g")
                    .attr("class", "grid")
                    .style("stroke-dasharray", ("3, 3"))
                    .append("text")
                    .style("text-anchor", "end")
                    .attr("x", -5)
                    .attr("y", 3)
                    .text(function(dim) {
                        return fixDimNames(dim);
                    })
                    .style("fill", function(d) {
                        return dimColorScale(rulePref.dimensionOrder[d]);
                    });
                // Call axis for each dimension
                axisG.each(function() {
                    d3.select(this).call(d3.svg.axis()
                        .scale(xScale)
                        .tickSize(0, 0, 0)
                        .orient("top")
                        .ticks(0));
                });
                //Add and store a brush for each axis.
                brushG = dimG.selectAll("g.brush").data(function(d) {
                    return [d];
                }, String);
                brushG.enter()
                    .append("g")
                    .attr("class", "brush");
                brushG.each(function(dim) {
                        d3.select(this).call(brushes[dim]);
                    })
                    .selectAll("rect")
                    .attr("y", -8)
                    .attr("height", 16);
                // Add blue foreground lines for focus.
                foreground = curPlot.selectAll("g.foreground").data([{}]);
                foreground.enter()
                    .append("g")
                    .attr("class", "foreground")
                    .style("opacity", 1E-6)
                    .transition()
                    .duration(1000)
                    .style("opacity", 0.6);
                foreLines = foreground.selectAll("path")
                    .data(brainArea.values, function(d) {
                        return d.Name;
                    });
                foreLines.exit()
                    .transition()
                    .duration(500)
                    .style("opacity", 1E-6)
                    .remove();
                foreLines.enter()
                    .append("path");
                // Transition back and fore lines at the same time to their current position
                d3.transition()
                    .duration(1000)
                    .ease("quad")
                    .each(function() {
                        backLines.transition()
                            .attr("d", path);
                        foreLines.transition()
                            .attr("d", path);
                    })
                    .transition()
                    .duration(500)
                    .each(function() {
                        // Translate each dimension group to its place on the yaxis
                        dimG
                            .transition()
                            .attr("transform", function(d) {
                                return "translate(0," + yScale(d) + ")";
                            })
                            .transition()
                            .style("opacity", 1);
                    });
                foreLines
                    .on("mouseover", mouseover)
                    .on("mouseout", mouseout)
                    .on("click", mouseclick)
                    .on("dblclick", mousedblclick)
                    // Axis with numbers
                var solidAxis = curPlot.selectAll("g.axis").data([{}]);
                solidAxis.enter()
                    .append("g")
                    .attr("class", "axis")
                    .attr("transform", "translate(0,0)")
                solidAxis
                    .call(d3.svg.axis()
                        .scale(xScale)
                        .orient("top")
                        .ticks(3)
                        .tickSize(3, 0, 0)
                    );
                drawLabels();
                // Labels
                function drawLabels() {
                    // Lines with arrows
                    arrowData = [{
                        "Name": "Orient.",
                        "values": [
                            [xScale(0) + 100, height],
                            [xScale(0) + 110, height]
                        ]
                    }, {
                        "Name": "Color",
                        "values": [
                            [xScale(0) - 100, height],
                            [xScale(0) - 110, height]
                        ]
                    }];
                    arrowG = curPlot.selectAll("g.arrowLine").data([{}]);
                    arrowG.enter()
                        .append("g")
                        .attr("class", "arrowLine");
                    arrowLine = arrowG.selectAll("path").data(arrowData);
                    arrowEnter = arrowLine.enter()
                        .append("path")
                        .attr("stroke", "black")
                        .attr("stroke-width", "1.5px")
                        .attr("marker-end", "url(#arrowhead)");
                    arrowLine
                        .attr("d", function(d) {
                            return line(d.values);
                        });
                    // Axis Labels
                    colorLabel = curPlot.selectAll("text.colorLabel").data([{}]);
                    colorLabel.enter()
                        .append("text")
                        .attr("class", "colorLabel")
                        .attr("x", xScale(0) - 10 + "px")
                        .attr("y", height + "px")
                        .attr("dy", 3 + "px")
                        .attr("text-anchor", "end")
                        .style("font-size", "12px")
                        .text("Higher Firing for");
                    colorLabel.enter()
                        .append("text")
                        .attr("class", "colorLabel")
                        .attr("x", xScale(0) - 20 + "px")
                        .attr("y", height + 10 + "px")
                        .attr("dy", 3 + "px")
                        .attr("text-anchor", "end")
                        .style("font-size", "12px")
                        .text("Color Rule");
                    orientLabel = curPlot.selectAll("text.orientLabel").data([{}]);
                    orientLabel.enter()
                        .append("text")
                        .attr("class", "orientLabel")
                        .attr("x", xScale(0) + 10 + "px")
                        .attr("y", height + "px")
                        .attr("dy", 3 + "px")
                        .attr("text-anchor", "start")
                        .style("font-size", "12px")
                        .text("Higher Firing for");
                    orientLabel.enter()
                        .append("text")
                        .attr("class", "orientLabel")
                        .attr("x", xScale(0) + 20 + "px")
                        .attr("y", height + 10 + "px")
                        .attr("dy", 3 + "px")
                        .attr("text-anchor", "start")
                        .style("font-size", "12px")
                        .text("Orient. Rule");
                    xAxisLabel = curPlot.selectAll("text.xAxisLabel").data([{}]);
                    xAxisLabel.enter()
                      .append("text")
                      .attr("class", "xAxisLabel")
                      .attr("x", xScale(0))
                      .attr("y", -20)
                      .attr("text-anchor", "middle")
                      .text("Norm. Firing Rate");

                    // Title
                    title = curPlot.selectAll("text.title").data([{}]);
                    title.enter()
                        .append("text")
                        .attr("class", "title")
                        .attr("x", xScale(0))
                        .attr("y", height + 50)
                        .attr("text-anchor", "middle")
                        .style("font-size", "28px")
                        .text(brainArea.key);
                }
            }
            // Returns the path for a given data point.
        function path(neuron) {
                return line(rulePref.dimensions.map(function(dim) {
                    return [xScale(+neuron[dim]), yScale(dim)];
                }));
            }
            // Replaces underscores with blanks and "plus" with "+"
        function fixDimNames(dimName) {
                var pat1 = /plus/,
                    pat2 = /_/g,
                    pat3 = /minus/;
                var fixedName = dimName.replace(pat1, "+").replace(pat2, " ").replace(pat3, "-");
                return fixedName;
            }
            // Handles a brush event, toggling the display of foreground lines.
        function brushed() {
                // On brush, fade tool tip
                toolTip
                    .style("opacity", 1e-6);
                // Get active dimension and their extents (min, max)
                var actives = rulePref.dimensions.filter(function(dim) {
                        return !brushes[dim].empty();
                    }),
                    extents = actives.map(function(dim) {
                        return brushes[dim].extent();
                    });

                d3.selectAll(".foreground").selectAll("path").style("display", function(neuron) {
                    return actives.every(function(activeDim, activeInd) {
                        return extents[activeInd][0] <= neuron[activeDim] && neuron[activeDim] <= extents[activeInd][1];
                    }) ? null : "none";
                });
            }
            // On mouseover, highlight line, pop up tooltip
        function mouseover(d) {
                // Highlight line by increasing width and changing its color
                d3.select(this).classed("active", true);

                // Remove current line and reappend so that it appears on top
                var node = d3.select(this).node(),
                    parent = node.parentNode;
                parent.appendChild(node);

                // Pop up tooltip
                toolTip
                    .style("opacity", .9)
                    .style("left", (d3.event.pageX + 40) + "px")
                    .style("top", (d3.event.pageY - 80) + "px")
                    .html(function() {
                        return d.Brain_Area + " Neuron " + d.Wire_Number + "." + d.Unit_Number + "<br>" +
                            "<b>" + d.Session_Name + "</b><br>" +
                            "Avg. Firing: " + d.Average_Firing_Rate + " Hz";
                    });
            }
            // On mouseout, hide tooltip, un-highlight line
        function mouseout() {
                toolTip
                    .style("opacity", 1e-6);
                d3.select(this).classed("active", false);
            }
            // On mouseclick
        function mouseclick(d) {
            d3.selectAll(".foreground").selectAll("path").style("display", function(neuron) {
                return (d.Name == neuron.Name) ? null : "none";
            })
        }
        function mousedblclick(d){
          console.log(d)
        }
    }


})();
