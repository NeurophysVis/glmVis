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
			.data([{width: width + margin.left + margin.right, height: height + margin.top + margin.bottom}])
			.enter()
			.append("svg");
		svg = d3.select("svg").attr({
			   width: function (d) {return d.width + margin.left + margin.right; },
			   height: function (d) {return d.height + margin.top + margin.bottom; }
		  })
      .append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

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
        // Preprocess the data
        // Filter out sorting Variables
        dimensions = d3.keys(csv[0]).filter(function(dim) {
          var sortingVariables = ["Neurons", "Session_Name", "Wire_Number", "Unit_Number", "Brain_Area", "Monkey", "Average_Firing_Rate"];
          return sortingVariables.indexOf(dim) == -1;
        });

        // Reverse dimension order for better understandability.
        dimensions = dimensions.reverse();

        // Formatting function for normalized firing rate
        var formatting = d3.format(".3n");

        // Normalize Firing Rates
        csv.map(function(neuron, neuron_ind) {
          dimensions.map(function(dim) {
            csv[neuron_ind][dim] = formatting(100 * +neuron[dim]/+neuron["Average_Firing_Rate"]);
          });
        });

        // Tool Tip - make a hidden div to appear as a tooltip when mousing over a line
        toolTip = d3.select("body").append("div")
            .attr("class", "tooltip")

        vis.data = csv; // copy to globally accessible object
      	// Draw visualization
				vis.draw(params);
      }); // end csv loading function
    }); // End load style function
  };
  vis.draw = function (params) {
    var PLOT_BUFFER = 60; // Defines separation between plots
        yScale = d3.scale.ordinal().rangePoints([height, 0], 1),
        line = d3.svg.line(),
        axis = d3.svg.axis(),
        background = [],
        foreground = [],
        curMonkey = d3.selectAll("#monkeySelector").selectAll(".selected").property("id");

    // Exclude neurons less than 1 Hz or not corresponding to the selected monkey
    var neurons = vis.data.filter(function(d) {
      var isMonkey = (d["Monkey"] == curMonkey) || (curMonkey == "All");
      return (+d["Average_Firing_Rate"] >= 1) && isMonkey;
    });

    // Set xScale domain and range by looping over each data dimension and getting its max and min
    xMin = d3.min(dimensions.map(function(dim) {
      return d3.min(neurons, function(neuron) { return +neuron[dim]; });
    }));

    xMax = d3.max(dimensions.map(function(dim) {
      return d3.max(neurons, function(neuron) { return +neuron[dim]; });
    }));

    // Make the max and min of the scale symmetric
    if (Math.abs(xMin) > Math.abs(xMax)) {
      xMax = Math.abs(xMin);
    } else if (Math.abs(xMin) < Math.abs(xMax)) {
      xMin = -1 * Math.abs(xMax);
    };

    // Set xScale for each dimension
    var xScale = dimensions.map(function(dim) {
        return d3.scale.linear().domain([xMin, xMax]).range([0, (width - PLOT_BUFFER)/2]);
      });

    // Nest data by brain area
    neurons = d3.nest()
      .key(function(d) { return d["Brain_Area"]; })
      .entries(neurons);



    plot_g = svg.selectAll("g.plot_g").data(neurons, function(d) {return d.key;});
    plot_g
				.enter()
  				.append("g")
  				.attr("transform", function(d,i) {
                      return "translate(" + ((width/2) + PLOT_BUFFER)*i + ", 0)";
                })
  				.attr("class", "plot_g");


      // Draw plot
      plot_g.each(drawParallel());

  }

// Draws parallel line plot
function drawParallel(brain_area) {

  var cur_plot = d3.select(this);
  // Join the trial data to svg containers ("g")
  var	brain_area_select = cur_plot.selectAll(".brain_area")
      .data(brain_area.values, function(d) {return d.Neurons; });

  xScale.map(function(brain_area_dim, ind) {
    brain_area_dim.unshift(avgRate_scale[ind]);
  });

  // Set yScale domain
  yScale.domain(dimensions);

  div = d3.select("#vis").selectAll(".chart").data(neurons);

  div.enter().append("div")
    .attr("class", "chart")
    .attr("id", function(d) {return d.key;})
    .append("svg");

  svg = div.select("svg")
      .attr("width", width + margin.left + margin.right )
      .attr("height", height + margin.top + margin.bottom )
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg.append("text")
        .attr("x", (width / 2))
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .text(function(d) {return d.key;});

  // Add grey background lines for context.
  background = svg.append("g")
    .attr("class", "background")
    .selectAll("path")
    .data(function(d) {return d.values;})
    .enter().append("path")
    .attr("d", path);

  // Add a group element for each dimension.
  var g = svg.selectAll(".dimension")
    .data(dimensions)
    .enter().append("g")
    .attr("class", "dimension")
    .attr("transform", function(d) { return "translate(0," + yScale(d) + ")"; });

  // Add an axis and title.
  g.append("g")
    .attr("class", "grid")
    .style("stroke-dasharray", ("3, 3"))
      .each(function(dim, dim_ind, div_ind) {
          d3.select(this).call(makeXAxis(dim, dim_ind, div_ind));
        })
    .append("text")
      .style("text-anchor", "end")
      .attr("x", -5)
      .attr("y", 3)
      .text(function(dim) { return fixDimNames(dim); });

  //Add and store a brush for each axis.
  g.append("g")
    .attr("class", "brush")
      .each(function(dim, dim_ind, div_ind) {
        d3.select(this).call(makeXBrush(dim, dim_ind, div_ind));
      })
    .selectAll("rect")
    .attr("y", -8)
    .attr("height", 16);

  // Add blue foreground lines for focus.
  foreground = svg.append("g")
    .attr("class", "foreground")
    .selectAll("path")
    .data(function(d) {return d.values;})
    .enter().append("path")
    .attr("d", path)
    .on("mouseover", mouseover)
    .on("mouseout", mouseout);

}

// Returns the path for a given data point.
function path(data_point, ind, div_ind) {
  return line(dimensions.map(function(dim, dim_ind) {
    return [xScale[div_ind][dim_ind](data_point[dim]), yScale(dim)];
  }));
}

// Handles a brush event, toggling the display of foreground lines.
function brush() {

  // On brush, fade tool tip
  toolTip
     .style("opacity", 1e-6);

  // Get active dimension and their extents (min, max)
  var actives = dimensions.filter(function(dim, dim_ind) {
    return !xScale[0][dim_ind].brush.empty() || !xScale[1][dim_ind].brush.empty();
    }),
  extents = neurons.map(function(neuron, div_ind) {
    return actives.map(function(dim) {
      var dim_ind = dimensions.indexOf(dim);
      return xScale[div_ind][dim_ind].brush.extent();
      })
    });
  // Set foreground lines in the extent to "display" style, "none" if not
  foreground.style("display", function(neuron) {
    return actives.every(function(active_dim, extent_ind) {
      return ((extents[0][extent_ind][0] <= neuron[active_dim])
        && (neuron[active_dim] <= extents[0][extent_ind][1]))
         ||
        ((extents[1][extent_ind][0] <= neuron[active_dim])
          && (neuron[active_dim] <= extents[1][extent_ind][1])
      );
    }) ? null : "none";
  });
}
// Creates the x-axis for a given dimension
function makeXAxis(dim, dim_ind, div_ind) {
  var newAxis;

  newAxis = axis
    .scale(xScale[div_ind][dim_ind])
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
// Creates a brush object for a given dimension
function makeXBrush(dim, dim_ind, div_ind) {
  xScale[div_ind][dim_ind].brush = d3.svg.brush()
    .x(xScale[div_ind][dim_ind])
    .on("brush", brush);
  return xScale[div_ind][dim_ind].brush;
}
// Replaces underscores with blanks and "plus" with "+"
function fixDimNames(dim_name) {
  var pat1 = /plus/,
      pat2 = /_/g,
      pat3 = /minus/;

  var fixed_name = dim_name.replace(pat1, "+").replace(pat2, " ").replace(pat3, "-");

  return fixed_name;
}
// On mouseover, highlight line, pop up tooltip
function mouseover(d) {
  // Highlight line by increasing width and changing its color
  d3.select(this).classed("active", true);

  // Remove current line and reappend so that it appears on top
  var node = d3.select(this).node(),
  parent = d3.select("#" + d.Brain_Area).selectAll(".foreground").node();

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
})();
