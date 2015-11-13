module.exports = {
  dotToPostgresJSON: function (o) {
    var terms = o.split(/[\.[]/).map(function (t) {
      if (t.slice(-1)[0] == ']') {
        t = t.slice(0, -1)
        if (!isNaN(parseInt(t))) {
          return t
        }
      }
      return "'" + t + "'"
    })
    return terms.join('->')
  }
}
