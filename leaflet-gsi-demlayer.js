(function() {

  var parseDEM = function(txt) {
    var dem = [];
    txt.split("\n").forEach(function(row) {
      if (row.indexOf(",") == -1)
        return;
      var b = [];
      row.split(",").forEach(function(col) {
        b.push(parseFloat(col));
      });
      dem.push(b);
    });
    return dem;
  };

  var getDEM = function(url) {
    return new Promise(function(resolve, reject) {
      var x = new XMLHttpRequest();
      x.onreadystatechange = function() {
        if (x.readyState == 4) {
          if (x.status == 200)
            resolve(parseDEM(x.responseText));
          else
            reject();
        }
      };
      x.open("get", url, true);
      x.send();
    });
  };

  var DEMLayer = L.GridLayer.extend({
    initialize : function(fn) {
      this.fn = fn;
      this.loading = {};
    },
    createTile : function(coords, done) {

      var img = L.DomUtil.create('img', 'leaflet-tile');
      var url = L.Util.template("http://cyberjapandata.gsi.go.jp/xyz/dem/{z}/{x}/{y}.txt", coords);
      var loading = this.loading;
      if (!loading[url])
        loading[url] = getDEM(url);
      var fn = this.fn;
      loading[url].then(function(dem) {
        delete loading[url];
        var p = new PNGlib(256, 256, 256);
        var background = p.color(0, 0, 0);
        for (var y = 0; y < 256; y++) {
          for (var x = 0; x < 256; x++) {
            var a = fn(x, y, dem[y][x], dem);
            if (a)
              p.buffer[p.index(x, y)] = p.color.apply(p, a);
          }
        }
        img.src = "data:image/png;base64," + p.getBase64();
        done(null, img);
      });
      return img;
    }
  });

  L.demLayer = function(fn) {
    return new DEMLayer(fn)
  };

})();
