var lMap, rMap;
var lYear, rYear;
var lYearLayers = {};
var rYearLayers = {};
var lRooftops, rRooftops;
var lRenewLayers = {};
var rRenewLayers = {};
var lRenewShown = false;
var rRenewShown = false;
var years = [2011, 2012, 2013, 2015, 2017];
var data = {};
// var rooftop;

require([
  "esri/dijit/Popup",
  "dojo/dom-construct",
  "esri/map",
  "esri/layers/ArcGISTiledMapServiceLayer",
  "esri/layers/CSVLayer",
  "esri/layers/FeatureLayer",
  "esri/layers/GraphicsLayer",
  "esri/Color",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/SimpleFillSymbol",
  "esri/renderers/SimpleRenderer",
  "esri/InfoTemplate",
  "esri/request",
  "dojo/_base/array",
  "esri/geometry/Point",
  "esri/graphic",
  "js/geojsonlayer.js",
  "dojo/domReady!"
], function(
  Popup,
  domConstruct,
  Map,
  ArcGISTiledMapServiceLayer,
  CSVLayer,
  FeatureLayer,
  GraphicsLayer,
  Color,
  SimpleMarkerSymbol,
  SimpleFillSymbol,
  SimpleRenderer,
  InfoTemplate,
  esriRequest,
  array,
  Point,
  Graphic,
  GeoJsonLayer
) {
  /*
    Initialize ArcGIS Maps Views
  */
  var initExt = new esri.geometry.Extent({
    xmin: 13520000,
    ymin: 2871000,
    xmax: 13545000,
    ymax: 2900000,
    spatialReference: { wkid: 3857 }
  });

  var lPopup = new Popup(
    {
      fillSymbol: new SimpleFillSymbol(
        "solid",
        null,
        new Color([9, 69, 70, 0.7])
      ),
      // popupWindow: false,
      titleInBody: false
    },
    domConstruct.create("div")
  );

  var rPopup = new Popup(
    {
      fillSymbol: new SimpleFillSymbol(
        "solid",
        null,
        new Color([9, 69, 70, 0.7])
      ),
      // popupWindow: false,
      titleInBody: false
    },
    domConstruct.create("div")
  );

  lMap = new Map("l-map", {
    // nav: true,
    extent: initExt,
    logo: false,
    zoom: 18,
    infoWindow: lPopup
  });

  rMap = new Map("r-map", {
    // nav: false,
    extent: initExt,
    logo: false,
    zoom: 18,
    infoWindow: rPopup
  });

  /*
    Bind right map with the left extent
  */
  var leftConnection = dojo.connect(lMap, "onExtentChange", leftChangeHandler);

  function leftChangeHandler(ext) {
    rMap.setExtent(ext);
  }

  /*
    Load historic maps
  */
  years.forEach(function(year) {
    mapServer =
      "https://www.historygis.udd.gov.taipei/arcgis/rest/services/Aerial/Ortho_" +
      year +
      "/MapServer";
    lYearLayers[year] = new ArcGISTiledMapServiceLayer(mapServer, {
      visible: false
    });
    lMap.addLayer(lYearLayers[year]);
    rYearLayers[year] = new ArcGISTiledMapServiceLayer(mapServer, {
      visible: false
    });
    rMap.addLayer(rYearLayers[year]);
  });

  lYear = 2017;
  rYear = 2011;
  changeYear(2012, 2017);

  /*
    Years selection slider
  */
  $("#year_slider").ionRangeSlider({
    type: "double",
    grid: true,
    from: 1,
    to: 4,
    step: 1,
    values: years,
    prettify_enabled: false,
    min_interval: 1,
    hide_min_max: true,
    onFinish: function(data) {
      changeYear(data.from_value, data.to_value);
    }
  });

  function changeYear(from, to) {
    dehighlight();
    if (from != lYear) {
      lYearLayers[lYear].hide();
      lYearLayers[from].show();
      lYear = from;
      displayGeoJsonLayer(true);
      clearStat();
    }
    if (to != rYear) {
      rYearLayers[rYear].hide();
      rYearLayers[to].show();
      rYear = to;
      displayGeoJsonLayer(false);
    }
  }

  /*
    Load rooftop csv
  */
  var dotMarker = new SimpleMarkerSymbol(
    "solid",
    13,
    null,
    new Color([241, 136, 5, 0.8])
  );
  var dotRenderer = new SimpleRenderer(dotMarker);

  lRooftops = new CSVLayer("data/Output.csv");
  lRooftops.setRenderer(dotRenderer);
  lMap.addLayer(lRooftops);
  lRooftops.hide();

  rRooftops = new CSVLayer("data/Output.csv");
  rRooftops.setRenderer(dotRenderer);
  rMap.addLayer(rRooftops);
  rRooftops.hide();

  /*
    Load Final.csv using papaparse.js
    Save as {rid:{attr:val}} dictionary
  */
  Papa.parse("data/Final.csv", {
    delimiter: ",",
    header: true,
    trimHeader: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    download: true,
    complete: function(results, file) {
      results.data.forEach(function(r) {
        data[r["district"]] = r;
      });
    }
  });

  /*
    Load GeoJson file (renewal areas)
  */
  var polyMarker = new SimpleFillSymbol(
    "solid",
    null,
    new Color([27, 153, 139, 0.6])
  );
  var polyRenderer = new SimpleRenderer(polyMarker);

  var highlightMarker = new SimpleFillSymbol(
    "solid",
    null,
    new Color([241, 195, 5, 0.6])
  );

  var highlight;
  var hasHighlight = false;

  lMap.on("load", function() {
    for (var rid in data) {
      lRenewLayers[rid] = addGeoJsonLayer(rid, true);
      rRenewLayers[rid] = addGeoJsonLayer(rid, false);
    }
  });

  function addGeoJsonLayer(rid, isLeft) {
    var infoTemplate = new InfoTemplate(
      rid,
      "Land Number: ${land_id}<br>" +
        data[rid]["featuresCount"] +
        " unit(s) with total area " +
        Math.round(data[rid]["area"])
    );

    var geoJsonLayer = new GeoJsonLayer({
      url: "data/GeoJson/" + rid + ".json",
      visible: false,
      infoTemplate: infoTemplate
    });

    // geoJsonLayer.on("load", function() {
    //   geoJsonLayer.maxScale = 0;
    // });

    /*
      When a renew area on the LEFT map is selected:
        1. Show statistics of both years
        2. Highlight selected renew area in the right map
      When a renew area on the RIGHT map is selected:
        1. Show statistics of right year
    */
    geoJsonLayer.on("click", function(c) {
      if (isLeft) {
        highlightRightMap(rid);
        setStat(rid, true);
      } else setStat(rid, false);
    });

    // Change cursor to indicate features are click-able
    geoJsonLayer.on("mouse-over", function() {
      if (isLeft) lMap.setMapCursor("pointer");
      else rMap.setMapCursor("pointer");
    });
    geoJsonLayer.on("mouse-out", function() {
      if (isLeft) lMap.setMapCursor("default");
      else rMap.setMapCursor("default");
    });

    // Zoom-in to this guy
    geoJsonLayer.on("update-end", function(e) {
      if (rid == "松山區B0647") lMap.setExtent(e.target.extent.expand(5));
    });

    geoJsonLayer.setRenderer(polyRenderer);

    if (isLeft) lMap.addLayer(geoJsonLayer);
    else rMap.addLayer(geoJsonLayer);

    return geoJsonLayer;
  }

  // Highlight selected renew area in the right map
  // (with ugly work-around for cloning GeoJsonLayer)
  function highlightRightMap(rid) {
    dehighlight();
    highlight = new GraphicsLayer();
    rRenewLayers[rid].graphics.forEach(function(g) {
      var gClone = new Graphic(g.toJson());
      gClone.setSymbol(highlightMarker);
      highlight.add(gClone);
    });
    rMap.addLayer(highlight);
    hasHighlight = true;
  }

  function setStat(rid, isLeft) {
    if (isLeft) {
      var pl = lYear > 2012 ? price(data[rid]["CurrentValue " + lYear]) : "-";
      var gl = lYear > 2012 ? green(data[rid]["greeniness " + lYear]) : "-";
      $("#l-price").text(pl);
      $("#l-green").text(gl);
      $("#l-roofNum").text(data[rid]["rooftopsNearby"]);
    }
    var pr = rYear > 2012 ? price(data[rid]["CurrentValue " + rYear]) : "-";
    var gr = rYear > 2012 ? green(data[rid]["greeniness " + rYear]) : "-";
    $("#r-price").text(pr);
    $("#r-green").text(gr);
    $("#r-roofNum").text(data[rid]["rooftopsNearby"]);
    setStatColor();
  }

  function price(v) {
    if (v > 1000000) return Math.round(v / 1000000);
    else return (v / 1000000).toFixed(1);
  }

  function green(v) {
    return Math.round(v * 100);
  }

  function setStatColor() {
    var grey = "#7C8D94",
      yellow = "#f18805",
      green = "#03b5aa",
      blue = "#2274a5";
    //$(this).css("color", "#ffffff");
    var lp = $("#l-price").text() == "-" ? 0 : parseFloat($("#l-price").text());
    var rp = $("#r-price").text() == "-" ? 0 : parseFloat($("#r-price").text());
    if (lp > rp) {
      $("#l-price").css("color", blue);
      $("#r-price").css("color", grey);
    } else if (lp < rp) {
      $("#r-price").css("color", blue);
      $("#l-price").css("color", grey);
    } else {
      $("#r-price").css("color", blue);
      $("#l-price").css("color", blue);
    }
    var lg = $("#l-green").text() == "-" ? 0 : parseInt($("#l-green").text());
    var rg = $("#r-green").text() == "-" ? 0 : parseInt($("#r-green").text());
    if (lg > rg) {
      $("#l-green").css("color", green);
      $("#r-green").css("color", grey);
    }
    else if (lg < rg) {
      $("#r-green").css("color", green);
      $("#l-green").css("color", grey);
    } 
    else {
      $("#r-green").css("color", green);
      $("#l-green").css("color", green);
    }
    var lr = parseInt($("#l-roofNum").text());
    var rr = parseInt($("#r-roofNum").text());
    if (lr > rr) {
      $("#l-roofNum").css("color", yellow);
      $("#r-roofNum").css("color", grey);
    } if (lr < rr) {
      $("#r-roofNum").css("color", yellow);
      $("#l-roofNum").css("color", grey);
    } else {
      $("#r-roofNum").css("color", yellow);
      $("#l-roofNum").css("color", yellow);
    }
  }

  function clearStat() {
    $("#l-price").text("");
    $("#l-green").text("");
    $("#l-roofNum").text("");
    $("#r-price").text("");
    $("#r-green").text("");
    $("#r-roofNum").text("");
  }

  /*
    De-highlight from right map when Pop-up is closed
  */
  lMap.infoWindow.on("hide", function() {
    dehighlight();
  });

  function dehighlight() {
    if (hasHighlight) {
      rMap.removeLayer(highlight);
      hasHighlight = false;
    }
  }

  /*
    Show renewal areas according to years
  */
  function displayGeoJsonLayer(isLeft) {
    for (var rid in data) {
      if (isLeft) {
        if (lRenewShown && data[rid]["e-year"] <= lYear)
          lRenewLayers[rid].show();
        else lRenewLayers[rid].hide();
      } else {
        if (rRenewShown && data[rid]["e-year"] <= rYear)
          rRenewLayers[rid].show();
        else rRenewLayers[rid].hide();
      }
    }
  }

  /*
    Checkboxes for hiding/showing renew areas & rooftops
  */

  $("#l-renew").iCheck({
    checkboxClass: "icheckbox_flat-grey",
    radioClass: "iradio_flat-grey"
  });

  $("#l-renew").on("ifChecked", function(event) {
    lRenewShown = true;
    displayGeoJsonLayer(true);
  });

  $("#l-renew").on("ifUnchecked", function(event) {
    lRenewShown = false;
    displayGeoJsonLayer(true);
    dehighlight();
  });

  $("#r-renew").iCheck({
    checkboxClass: "icheckbox_flat-grey",
    radioClass: "iradio_flat-grey"
  });

  $("#r-renew").on("ifChecked", function(event) {
    rRenewShown = true;
    displayGeoJsonLayer(false);
  });

  $("#r-renew").on("ifUnchecked", function(event) {
    rRenewShown = false;
    displayGeoJsonLayer(false);
    dehighlight();
  });

  $("#l-roof").iCheck({
    checkboxClass: "icheckbox_flat-grey",
    radioClass: "iradio_flat-grey"
  });

  $("#l-roof").on("ifChecked", function(event) {
    lRooftops.show();
  });

  $("#l-roof").on("ifUnchecked", function(event) {
    lRooftops.hide();
  });

  $("#r-roof").iCheck({
    checkboxClass: "icheckbox_flat-grey",
    radioClass: "iradio_flat-grey"
  });

  $("#r-roof").on("ifChecked", function(event) {
    rRooftops.show();
  });

  $("#r-roof").on("ifUnchecked", function(event) {
    rRooftops.hide();
  });

  // function dataLayerHandler(isLeft, isRenew, isChecked) {
  //   lMap.removeAllLayers();
  //   lMap.addLayers([yearLayers[from]]);
  //   rMap.removeAllLayers();
  //   rMap.addLayers([yearLayers[to]]);
  // }
});
