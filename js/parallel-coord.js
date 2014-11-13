(function () {
  vis = {};
	var width, height,
		chart, svg,
		defs, style;
  // Set svg sizing and margins
  vis.init = function (params) {

    if (!params) {params = {}; }
		    chart = d3.select(params.chart || "#chart"); // placeholder div for svg
    var margin = {top: 50, right: 10, bottom: 10, left: 150},
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

      var dimensionOrder = ["minus1_Std_Dev_of_Prep_Time","plus1_Std_Dev_of_Prep_Time",
                            "Congruent","Incongruent",
                            "Previous_Congruent","Previous_Incongruent",
                            "Repetition11plus","Repetition10","Repetition9","Repetition8","Repetition7",
                            "Repetition6","Repetition5","Repetition4","Repetition3","Repetition2","Repetition1",
                            "No_Previous_Error","Previous_Error",
                            "Rule"];
      // Extract plot dimensions
      var dimensions = dimensionOrder.filter(function(dim) {
        return d3.keys(data[0]).indexOf(dim) > -1;
      });

      // Formatting function for normalized firing rate
      var formatting = d3.format(".3g");

      // Normalize Firing Rates
      data.map(function(neuron, neuron_ind) {
        dimensions.map(function(dim) {
          var value = +neuron[dim]/+neuron["Average_Firing_Rate"];
          if (Math.abs(value) < 1E-3 || Math.abs(value) === Infinity || isNaN(value)) {
            value = 0.00;
          }
          data[neuron_ind][dim] = formatting(value);
        });
      });

      vis.dimensions = dimensions;
      return data;

    }
  };
  vis.draw = function (params) {
    var PLOT_BUFFER = 80,
        line = d3.svg.line(),
        curMonkey = d3.selectAll("#monkeySelector").selectAll(".selected").property("id"),
        xScale, yScale, plot_g, brushes = {};

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
      return isMonkey;
    });

    setupScales(neurons);

    // Nest data by brain area
    neurons = d3.nest()
      .key(function(d) { return d["Brain_Area"]; })
      .sortKeys(d3.ascending)
      .entries(neurons);

    // Create brushes for all the dimensions
    vis.dimensions.map(function(dim) {brushes[dim] = d3.svg.brush()
      .x(xScale)
      .on("brush", brushed)});

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
    d3.selectAll("#intervalSelector").selectAll("a").on("click", function() {
        d3.selectAll("#intervalSelector").selectAll("a").classed("selected", false);
        d3.select(this).classed("selected", true);
        curInterval = d3.select(this).property("id");
        params.data = curInterval + " apc";
        vis.loaddata(params);
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
        var foreground, background, dim_group, axis_group, brush_group,
        back_lines, fore_lines, title, zero_group, zero_line,
        arrow_data, arrow_line, arrow_group;

        // Add grey background lines for context.
        background = cur_plot.selectAll("g.background")
          .data([{}]);
        background.enter()
          .append("g")
          .attr("class", "background");
        back_lines = background
          .selectAll("path")
          .data(brain_area.values, function(d) {return d.Name;});
        back_lines.exit()
          .transition()
            .duration(10)
            .ease("linear")
          .remove();
        back_lines.enter()
          .append("path");
        back_lines
          .transition()
            .duration(1000)
            .delay(200)
            .ease("linear")
          .attr("d", path);
      // Line at Zero
      zero_data = [
        [[xScale(0), 0], [xScale(0), height]]
      ];
      zero_group = cur_plot.selectAll("g.plot_line").data([{}]);
      zero_group.enter()
        .append("g")
        .attr("class", "plot_line");
      zero_line = zero_group.selectAll("path").data(zero_data);
      zero_line.enter()
        .append("path")
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
        .style("opacity", 0.9);
      zero_line
        .attr("d", line);
        // Add a group element for each dimension.
        dims = cur_plot.selectAll("g.dimensions").data([{}]);
        dims.enter()
          .append("g")
          .attr("class", "dimensions");
        // Select dimensions group and bind to dimension data
        dim_group = dims.selectAll("g.dimension")
          .data(vis.dimensions, String);
        // Remove dimension groups that don't currently exist
        dim_group.exit()
          .transition()
            .duration(100)
          .style("opacity", 1E-6)
          .remove();
        // Append group elements to new dimensions
        dim_group.enter()
          .append("g")
          .attr("class", "dimension")
          .style("opacity", 1E-6);
        // Translate each dimension group to its place on the yaxis
        dim_group
          .attr("transform", function(d) { return "translate(0," + yScale(d) + ")"; })
          .transition()
            .duration(100);
        dim_group
          .transition()
            .duration(1000)
            .style("opacity", 1);
        // Select axis and text for each dimension
        axis_group = dim_group.selectAll("g.grid").data(function(d) {return [d];}, String);
        // Append axis and text if it doesn't exist
        axis_group.enter()
          .append("g")
          .attr("class", "grid")
          .style("stroke-dasharray", ("3, 3"))
          .append("text")
            .style("text-anchor", "end")
            .attr("x", -5)
            .attr("y", 3)
            .text(function(dim) { return fixDimNames(dim); });
        // Call axis for each dimension
        axis_group.each(function() {
            d3.select(this).call(d3.svg.axis()
              .scale(xScale)
              .tickSize(0, 0, 0)
              .orient("top")
              .ticks(0));
          });
        //Add and store a brush for each axis.
        brush_group = dim_group.selectAll("g.brush").data(function(d) {return [d];}, String);
        brush_group.enter()
          .append("g")
          .attr("class", "brush");
        brush_group.each(function(dim) {
            d3.select(this).call(brushes[dim]);
          })
          .selectAll("rect")
          .attr("y", -8)
          .attr("height", 16);
        // Add blue foreground lines for focus.
        foreground = cur_plot.selectAll("g.foreground").data([{}]);
        foreground.enter()
          .append("g")
          .attr("class", "foreground");
        fore_lines = foreground.selectAll("path")
          .data(brain_area.values, function(d) {return d.Name;});
        fore_lines.exit()
          .transition()
            .duration(10)
            .ease("linear")
          .remove();
        fore_lines.enter()
          .append("path");
        fore_lines
          .transition()
            .duration(1000)
            .delay(function(d, i) { return i; })
            .ease("linear")
          .attr("d", path);
        fore_lines
          .on("mouseover", mouseover)
          .on("mouseout", mouseout)
          .on("click", mouseclick)
        // Title
        title = cur_plot.selectAll("text.title").data([{}]);
        title.enter()
          .append("text")
          .attr("class", "title")
          .attr("x", -5)
          .attr("y", -20)
          .attr("text-anchor", "end")
          .style("font-size", "16px")
          .text(brain_area.key);
        // Axis with numbers
        var solidAxis = cur_plot.selectAll("g.axis").data([{}]);
        solidAxis.enter()
          .append("g")
          .attr("class", "axis")
          .attr("transform", "translate(0,0)")
        solidAxis
		      .call(d3.svg.axis()
	               .scale(xScale)
	               .orient("top")
                 .ticks(5)
                 .tickSize(0, 0, 0)
        );
        // Lines with arrows
        arrow_data = [{
          "Name": "Orientation",
          "values": [[xScale(0) + 10, height], [xScale(0) + 50, height]]
        },
        {
          "Name": "Color",
          "values": [[xScale(0) - 10, height], [xScale(0) - 50, height]]
        }];
        arrow_group = cur_plot.selectAll("g.arrow_line").data([{}]);
        arrow_group.enter()
          .append("g")
          .attr("class", "arrow_line");
        arrow_line = arrow_group.selectAll("path").data(arrow_data);
        arrow_enter = arrow_line.enter()
          .append("path")
            .attr("stroke", "black")
            .attr("stroke-width", "1.5px")
            .attr("marker-end", "url(#arrowhead)");
        arrow_line
          .attr("d", function(d) {return line(d.values);});
      }
      // Returns the path for a given data point.
      function path(neuron) {
        return line(vis.dimensions.map(function(dim) {
          return [xScale(+neuron[dim]), yScale(dim)];
        }));
      }
      // Replaces underscores with blanks and "plus" with "+"
      function fixDimNames(dim_name) {
        var pat1 = /plus/,
            pat2 = /_/g,
            pat3 = /minus/;
        var fixed_name = dim_name.replace(pat1, "+").replace(pat2, " ").replace(pat3, "-");
        return fixed_name;
      }
      // Handles a brush event, toggling the display of foreground lines.
      function brushed() {
        // On brush, fade tool tip
        toolTip
           .style("opacity", 1e-6);
        // Get active dimension and their extents (min, max)
        var actives = vis.dimensions.filter(function(dim) {
          return !brushes[dim].empty();
          }),
        extents = actives.map(function(dim) {
            return brushes[dim].extent();
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
      // On mouseclick
      function mouseclick(d) {
        d3.selectAll(".foreground").selectAll("path").style("display", function(neuron) {
          return (d.Name == neuron.Name) ? null : "none";
        })
      }
  }


})();
