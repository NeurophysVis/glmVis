// Set svg sizing and margins
var margin = {top: 30, right: 10, bottom: 10, left: 150},
width = 500 - margin.left - margin.right,
height = 500 - margin.top - margin.bottom;

// Preallocate scales, data, and lines;
var yScale = d3.scale.ordinal().rangePoints([height, 0], 1),
xScale = {};

var data = {};

var line = d3.svg.line(),
axis = d3.svg.axis(),
background,
foreground;

// Tool Tip - make a hidden div to appear as a tooltip when mousing over a line
var toolTip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Formatting function for digits
var formatting = d3.format(".3n");

// Load Data
timePeriod = "Rule Stimulus";
d3.csv("DATA/" + timePeriod + " apc.csv", function(error, data) {

  // Filter out sorting Variables
  dimensions = d3.keys(data[0]).filter(function(dim) {
    var sortingVariables = ["Neurons", "Session_Name", "Wire_Number", "Unit_Number", "Brain_Area", "Monkey", "Average_Firing_Rate"];
    return sortingVariables.indexOf(dim) == -1;
  });

  // Exclude neurons less than 1 Hz
  data = data.filter(function(d) {
    return +d["Average_Firing_Rate"] >= 1;
  })

  // Reverse dimension order for better understandability.
  dimensions = dimensions.reverse();

  // Normalize Firing Rates
  data.map(function(neuron, neuron_ind) {
    dimensions.map(function(dim) {
      data[neuron_ind][dim] = formatting(100 * +neuron[dim]/+neuron["Average_Firing_Rate"]);
    });
  });

  // Set xScale domain and range by looping over each data dimension and getting its max and min
  xMin = d3.min(dimensions.map(function(dim) {
    return d3.min(data, function(neuron) { return +neuron[dim]; });
  }));

  xMax = d3.max(dimensions.map(function(dim) {
    return d3.max(data, function(neuron) { return +neuron[dim]; });
  }));

  // Make the max and min of the scale symmetric
  if (Math.abs(xMin) > Math.abs(xMax)) {
    xMax = Math.abs(xMin);
  } else if (Math.abs(xMin) < Math.abs(xMax)) {
    xMin = -1 * Math.abs(xMax);
  };

  // Set up average firing rate scale
  var firingRate_extent = d3.extent(data, function(neuron) {
    return +neuron["Average_Firing_Rate"];
  });

  // Nest data by brain area
  neurons = d3.nest()
    .key(function(d) { return d["Brain_Area"]; })
    .entries(data);

  // Different scale for average firing rate
  avgRate_scale = neurons.map(function(brain_area) {
    return d3.scale.linear().domain(firingRate_extent).range([0, width]);
  });

  // Set xScale for each dimension and brain area
  xScale = neurons.map(function(dat) {
    return dimensions.map(function(dim) {
      return d3.scale.linear().domain([xMin, xMax]).range([0, width]);
    });
  });

  // Add average firing rate to beginning of dimensions array
  dimensions.unshift("Average_Firing_Rate");
  xScale.map(function(brain_area_dim, ind) {
    brain_area_dim.unshift(avgRate_scale[ind]);
  });

  // Set yScale domain
  yScale.domain(dimensions);

  // Draw plot
  drawParallel()

});

// Draws parallel line plot
function drawParallel() {
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
  xScale[div_ind][dim_ind].brush = d3.svg.brush().x(xScale[div_ind][dim_ind]).on("brush", brush);
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

  d3.select(this).classed("active", true);
  // Select current line
  var node = d3.select(this).node(),
  // Find group line belonds to
  parent = d3.select("#" + d.Brain_Area).selectAll(".foreground").node();
  // Remove current line and reappend so that it appears on top
  parent.removeChild(node);
  parent.appendChild(node);

  toolTip
     .style("opacity", .9)
     .style("left", (d3.event.pageX + 30) + "px")
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
