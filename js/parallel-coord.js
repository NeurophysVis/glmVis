(function () {
  vis = {};
	var width, height,
		chart, svg,
		defs, style;
  // Set svg sizing and margins
  vis.init = function (params) {

    if (!params) {params = {}; }
		    chart = d3.select(params.chart || "#chart"); // placeholder div for svg
    var margin = {top: 30, right: 10, bottom: 10, left: 150},
    	padding = {top: 60, right: 60, bottom: 60, left: 60};
		var outerWidth = params.width || 960,
			outerHeight = params.height || 500,
			innerWidth = outerWidth - margin.left - margin.right,
			innerHeight = outerHeight - margin.top - margin.bottom;

		width = innerWidth - padding.left - padding.right;
		height = innerHeight - padding.top - padding.bottom;

    chart.selectAll("svg")
			.data([{
        width: width + margin.left + margin.right,
        height: height + margin.top + margin.bottom}])
			.enter()
			.append("svg");
		svg = d3.select("svg").attr({
			   width: function (d) {return d.width + margin.left + margin.right; },
			   height: function (d) {return d.height + margin.top + margin.bottom; }
		  })
      .append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .attr("id", "drawing_area");

    // vis.init can be re-ran to pass different height/width values
		// to the svg. this doesn't create new svg elements.
		style = svg.selectAll("style").data([{}]).enter()
			.append("style")
			.attr("type", "text/css");
		// this is where we can insert style that will affect the svg directly.
		defs = svg.selectAll("defs").data([{}]).enter()
			.append("defs");

    // Load Data
		vis.loaddata(params);
	};
	vis.loaddata = function (params) {
		if (!params) {params = {}; }
    // Apply style file (css) and embed in svg
		d3.text(params.style || "/css/parallel-coord.txt", function (error, txt) {
			// Embedded style file in the svg.
			style.text(txt);
			// ("#" + Math.random()) makes sure the script loads the file each time instead of using a cached version, remove once live
			var cur_file_name = "/DATA/" + params.data + ".csv" + "#" + Math.random();
      // Load csv data
      d3.csv(cur_file_name, function(error, csv) {

        vis.data = preProcess(csv); // copy to globally accessible object
      	// Draw visualization
				vis.draw(params);
      }); // end csv loading function
    }); // End load style function

    // Preprocess Data
    function preProcess(data) {

      var sortingVariables = ["Neurons", "Session_Name", "Wire_Number", "Unit_Number", "Brain_Area", "Monkey", "Average_Firing_Rate"];
      // Extract plot dimensions
      var dimensions = d3.keys(data[0]).filter(function(dim) {
        return sortingVariables.indexOf(dim) == -1;
      });

      // Reverse dimension order for better understandability.
      dimensions = dimensions.reverse();

      // Formatting function for normalized firing rate
      var formatting = d3.format(".3n");

      // Normalize Firing Rates
      data.map(function(neuron, neuron_ind) {
        dimensions.map(function(dim) {
          data[neuron_ind][dim] = formatting(100 * +neuron[dim]/+neuron["Average_Firing_Rate"]);
        });
      });

      vis.dimensions = dimensions;
      return data;

    }
  };
  vis.draw = function (params) {
    var PLOT_BUFFER = 60,
        line = d3.svg.line(),
        axis = d3.svg.axis(),
        curMonkey = d3.selectAll("#monkeySelector").selectAll(".selected").property("id"),
        xScale, yScale, plot_g, brushes;

    // Tool Tip - make a hidden div to appear as a tooltip when mousing over a line
    toolTip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 1e-6);

    // Exclude neurons less than 1 Hz or not corresponding to the selected monkey
    var neurons = vis.data.filter(function(d) {
      var isMonkey = (d["Monkey"] == curMonkey) || (curMonkey == "All");
      return (+d["Average_Firing_Rate"] >= 1) && isMonkey;
    });

    setupScales(neurons);

    // Nest data by brain area
    neurons = d3.nest()
      .key(function(d) { return d["Brain_Area"]; })
      .entries(neurons);

    plot_g = svg.selectAll("g.brain_area").data(neurons);
    plot_g
				.enter()
  				.append("g")
  				.attr("transform", function(d,i) {
                      return "translate(" + ((width/2) + PLOT_BUFFER)*i + ", 0)";
                })
          .attr("class", "brain_area")
          .attr("id", function(d) {return d.key;})

    brushes = vis.dimensions.map(function(dim, dim_ind) {return makeXBrush(dim, dim_ind)});

    plot_g
          .each(drawParallel);
    // Set up brushes for dimensions
    // d3.selectAll(".brain_area").selectAll(".dimension")
    //   .append("g")
    //     .attr("class", "brush")
    //       .each(function(dim, dim_ind, div_ind) {
    //         d3.select(this).call(makeXBrush(dim, dim_ind, div_ind));
    //       })
    //     .selectAll("rect")
    //     .attr("y", -8)
    //     .attr("height", 16);



      // Set up Scales
      function setupScales(data) {
        var xMin, xMax;

        // Set xScale domain and range by looping over each data dimension and getting its max and min
        xMin = d3.min(vis.dimensions.map(function(dim) {
          return d3.min(data, function(neuron) { return +neuron[dim]; });
        }));

        xMax = d3.max(vis.dimensions.map(function(dim) {
          return d3.max(data, function(neuron) { return +neuron[dim]; });
        }));

        // Make the max and min of the scale symmetric
        if (Math.abs(xMin) > Math.abs(xMax)) {
          xMax = Math.abs(xMin);
        } else if (Math.abs(xMin) < Math.abs(xMax)) {
          xMin = -1 * Math.abs(xMax);
        };

        // Set xScale for each dimension
        xScale = vis.dimensions.map(function(dim) {
            return d3.scale.linear().domain([xMin, xMax]).range([0, (width - PLOT_BUFFER)/2]);
          });

        yScale = d3.scale.ordinal()
          .domain(vis.dimensions)
          .rangePoints([height, 0], 1);
      }
      // Draws parallel line plot
      function drawParallel(brain_area) {

        var cur_plot = d3.select(this);

        // Add grey background lines for context.
        cur_plot.append("g")
          .attr("class", "background")
          .selectAll("path")
          .data(function(d) {return d.values;})
          .enter().append("path")
          .attr("d", path);

        // Add a group element for each dimension.
        var dim_g = cur_plot.selectAll(".dimension")
          .data(vis.dimensions)
          .enter().append("g")
          .attr("class", "dimension")
          .attr("transform", function(d) { return "translate(0," + yScale(d) + ")"; });

        // Add an axis and title.
        dim_g.append("g")
          .attr("class", "grid")
          .style("stroke-dasharray", ("3, 3"))
            .each(function(dim, dim_ind) {
                d3.select(this).call(makeXAxis(dim, dim_ind));
              })
          .append("text")
            .style("text-anchor", "end")
            .attr("x", -5)
            .attr("y", 3)
            .text(function(dim) { return fixDimNames(dim); });

        //Add and store a brush for each axis.
        dim_g.append("g")
          .attr("class", "brush")
            .each(function(dim, dim_ind) {
              d3.select(this).call(brushes[dim_ind]);
            })
          .selectAll("rect")
          .attr("y", -8)
          .attr("height", 16);

        // Add blue foreground lines for focus.
        cur_plot.append("g")
          .attr("class", "foreground")
          .selectAll("path")
          .data(function(d) {return d.values;})
          .enter().append("path")
          .attr("d", path)
          .on("mouseover", mouseover)
          .on("mouseout", mouseout);

      }

      // Returns the path for a given data point.
      function path(data_point) {
        return line(vis.dimensions.map(function(dim, dim_ind) {
          return [xScale[dim_ind](data_point[dim]), yScale(dim)];
        }));
      }
      // Creates the x-axis for a given dimension
      function makeXAxis(dim, dim_ind) {
        var newAxis;

        newAxis = axis
          .scale(xScale[dim_ind])
          .tickSize(0, 0, 0);
        // Different axes for different dimensions
        switch(dim) {
          case "Rule":
            newAxis
              .orient("top")
              .ticks(3);
            break;
          case "Average_Firing_Rate":
            newAxis
              .orient("bottom")
              .ticks(5);
            break;
          default:
            newAxis
              .orient("top")
              .ticks(0);
        }

        return newAxis;
      }
      // Replaces underscores with blanks and "plus" with "+"
      function fixDimNames(dim_name) {
        var pat1 = /plus/,
            pat2 = /_/g,
            pat3 = /minus/;

        var fixed_name = dim_name.replace(pat1, "+").replace(pat2, " ").replace(pat3, "-");

        return fixed_name;
      }
      // Creates a brush object for a given dimension
      function makeXBrush(dim, dim_ind) {
        var brush = d3.svg.brush()
          .x(xScale[dim_ind])
          .on("brush", brushed);
        return brush;
      }
      // Handles a brush event, toggling the display of foreground lines.
      function brushed() {
        // On brush, fade tool tip
        toolTip
           .style("opacity", 1e-6);

        // Get active dimension and their extents (min, max)
        var actives = vis.dimensions.filter(function(dim, dim_ind) {
          return !brushes[dim_ind].empty();
          }),
        extents = actives.map(function(dim) {
            var dim_ind = vis.dimensions.indexOf(dim);
            return brushes[dim_ind].extent();
          });

        d3.selectAll(".foreground").selectAll("path").style("display", function(neuron){
            return actives.every(function(active_dim, active_ind) {
              return extents[active_ind][0] <= neuron[active_dim] && neuron[active_dim] <= extents[active_ind][1];
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
             return  d.Brain_Area + " Neuron " + d.Wire_Number + "." + d.Unit_Number + "<br>" +
                     "<b>" + d.Session_Name + "</b><br>" +
                     "Avg. Firing: " + d.Average_Firing_Rate+ " Hz";
           });
      }
      // On mouseout, hide tooltip, un-highlight line
      function mouseout() {
        toolTip
           .style("opacity", 1e-6);
        d3.select(this).classed("active", false);
      }
  }


})();
