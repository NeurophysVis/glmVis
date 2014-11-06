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
    var PLOT_BUFFER = 80,
        line = d3.svg.line(),
        axis = d3.svg.axis(),
        curMonkey = d3.selectAll("#monkeySelector").selectAll(".selected").property("id"),
        xScale, yScale, plot_g, brushes;

    // Tool Tip - make a hidden div to appear as a tooltip when mousing over a line
    toolTip = d3.select("body").selectAll("div.tooltip").data([{}]);
    toolTip
        .enter()
        .append("div")
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

    // Create brushes for all the dimensions
    brushes = vis.dimensions.map(function(dim, dim_ind) {return makeXBrush(dim, dim_ind)});

    plot_g = svg.selectAll("g.brain_area").data(neurons);
    plot_g
				.enter()
  				.append("g")
  				.attr("transform", function(d,i) {
                      return "translate(" + ((width/2) + PLOT_BUFFER)*i + ", 0)";
                })
          .attr("class", "brain_area")
          .attr("id", function(d) {return d.key;});

    plot_g
          .each(drawParallel);

    d3.selectAll("#monkeySelector").selectAll("a").on("click", function() {
        d3.selectAll("#monkeySelector").selectAll("a").classed("selected", false);
        d3.select(this).classed("selected", true);
        vis.draw(params)
      });

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
        xScale = d3.scale.linear()
          .domain([xMin, xMax])
          .range([0, (width - PLOT_BUFFER)/2]);

        yScale = d3.scale.ordinal()
          .domain(vis.dimensions)
          .rangePoints([height, 0], 1);
      }
      // Draws parallel line plot
      function drawParallel(brain_area) {

        var cur_plot = d3.select(this);
        var foreground, background, dim_g, dim_g_Enter,
        back_lines, fore_lines, title;

        // Add grey background lines for context.
        background = cur_plot.selectAll("g.background")
          .data([{}]);
        background
          .enter()
          .append("g")
          .attr("class", "background");
        back_lines = background
          .selectAll("path")
          .data(brain_area.values, function(d) {return d.Neurons;});
        back_lines
          .enter().append("path")
          .attr("d", path);
        back_lines
          .exit().remove();

        // Add a group element for each dimension.
        // Remove prior axes
        dim_g = cur_plot.selectAll("g.dimension")
          .data(vis.dimensions);
        dim_g_Enter = dim_g
          .enter().append("g");
        dim_g_Enter
          .attr("class", "dimension")
          .attr("transform", function(d) { return "translate(0," + yScale(d) + ")"; });
        // Append Axis for each dimension
        dim_g_Enter
          .append("g")
          .attr("class", "grid")
          .style("stroke-dasharray", ("3, 3"))
          .append("text")
            .style("text-anchor", "end")
            .attr("x", -5)
            .attr("y", 3)
            .text(function(dim) { return fixDimNames(dim); });
        cur_plot.selectAll("g.grid").each(function(dim, dim_ind) {
            d3.select(this).call(makeXAxis(dim, dim_ind));
          });
        //Add and store a brush for each axis.
        dim_g_Enter.append("g")
          .attr("class", "brush");
        cur_plot.selectAll("g.brush").each(function(dim, dim_ind) {
            d3.select(this).call(brushes[dim_ind]);
          })
          .selectAll("rect")
          .attr("y", -8)
          .attr("height", 16);
        dim_g.exit().remove();

        // Add blue foreground lines for focus.
        foreground = cur_plot.selectAll("g.foreground").data([{}]);
        foreground.enter()
          .append("g")
          .attr("class", "foreground");
        fore_lines = foreground.selectAll("path")
          .data(brain_area.values, function(d) {return d.Neurons;});
        fore_lines
          .enter().append("path")
          .attr("d", path)
          .on("mouseover", mouseover)
          .on("mouseout", mouseout);
        fore_lines
          .transition()
            .duration(10);
        fore_lines.exit().remove();

        // Title
        title = cur_plot.selectAll("text.title").data([{}]);
        title.enter()
          .append("text")
          .attr("class", "title")
          .attr("x", ((width)/4) - 20)
          .attr("y", -15)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .text(brain_area.key);
      }
      // Returns the path for a given data point.
      function path(data_point) {
        return line(vis.dimensions.map(function(dim, dim_ind) {
          return [xScale(data_point[dim]), yScale(dim)];
        }));
      }
      // Creates the x-axis for a given dimension
      function makeXAxis(dim, dim_ind) {
        var newAxis;

        newAxis = axis
          .scale(xScale)
          .tickSize(0, 0, 0);
        // Different axes for different dimensions
        switch(dim) {
          case "Rule":
            newAxis
              .orient("top")
              .ticks(5)
              .tickSize(5, 0, 0);
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
          .x(xScale)
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
