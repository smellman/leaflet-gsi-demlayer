(function() {

  var parseDEM = function(buffer) {
    var view = new DataView(buffer);
    var pos = 0;
    var _x = view.getUint32(pos, true);
    pos += Uint32Array.BYTES_PER_ELEMENT; // 4
    var _y = view.getUint32(pos, true);
    pos += Uint32Array.BYTES_PER_ELEMENT; // 8
    var _z = view.getUint8(pos, true);
    pos += Uint8Array.BYTES_PER_ELEMENT; // 9
    var maximumHeight = view.getFloat32(pos, true);
    pos += Float32Array.BYTES_PER_ELEMENT;
    var minimumHeight = view.getFloat32(pos, true);
    pos += Float32Array.BYTES_PER_ELEMENT;

    // availableは飛ばす
    var _availables_length = 256*256 / 8;
    var a_pos = pos;
    pos += Uint8Array.BYTES_PER_ELEMENT * _availables_length;
    // heights
    var height_counts = view.getUint32(pos, true);
    pos += Uint32Array.BYTES_PER_ELEMENT;
    var zigZagDecode = function(value) {
        return (value >> 1) ^ (-(value & 1));
    }
    var encodedHeights = new Uint16Array(height_counts);
    var height = 0;
    for (var i = 0; i < height_counts; i++) {
        height += zigZagDecode(view.getUint16(pos, true));
        encodedHeights[i] = height;
        pos += Uint16Array.BYTES_PER_ELEMENT;
    }

    var max_min = maximumHeight - minimumHeight;
    var _height = function(value) {
        return ((value / 32767.0) * (max_min)) + minimumHeight;
    }
    var data_pos = 0;
    var dem = [];
    // availableの値をパースしながら入れていく
    var j_max = 256/8;
    for (var i = 0; i < 256; i++) {
        var b = [];
        for (var j = 0; j < j_max; j++) {
            var a = view.getUint8(a_pos, true);
            a_pos += Uint8Array.BYTES_PER_ELEMENT;
            for (k = 0; k < 8; k++) {
                if ((a & (1 << k)) != 0) {
                    b.push(_height(encodedHeights[data_pos]));
                    data_pos += 1;
                } else {
                    b.push(NaN);
                }
            }
        }
        dem.push(b);
    }

    return dem;
  };

  var getDEM = function(url) {
    return new Promise(function(resolve, reject) {
      var x = new XMLHttpRequest();
      x.responseType = "arraybuffer";
      x.onload = function() {
        if (x.readyState == 4) {
          if (x.status == 200)
            resolve(parseDEM(x.response));
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
      var url = L.Util.template("http://tiles.smellman.org/smelldem/{z}/{x}/{y}.smelldem", coords);
      //var url = L.Util.template("http://localhost:8007/output4/{z}/{x}/{y}.smelldem", coords);
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
