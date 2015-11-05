var Promise = require('lie')
var cuid = require('cuid')

var pgp = require('pg-promise')({promiseLib: Promise})

var handle = function (message) {
  return function (err) {
    console.log(message + ':', err)
    throw err
  }
}

var pgjson = (function () {
  function pgjson (cn) {
    this.db = pgp(cn)

    this.wait = Promise.resolve()
    this.init()
  }

  pgjson.prototype.post = function (doc) {
    if (Array.isArray(doc)) {
      return pgjson.prototype.postBulk.apply(this, arguments)
    }

    var db = this.db
    doc._id = cuid()

    return this.wait.then(function () {
      return db.one(
        'INSERT INTO pgjson.main (id, doc) VALUES ($1, $2) RETURNING id',
        [doc._id, doc]
      )
    })
    .then(function (row) {
      return {ok: true, id: row.id}
    })
    .catch(handle('problem posting doc'))
  }

  pgjson.prototype.postBulk = function (docs) {
    var db = this.db

    var ids = []
    var valuesq = []
    var valuesv = []
    for (var i = 0; i < docs.length; i++) {
      var doc = docs[i]
      var j = 1 + i*2
      var id = cuid()
      doc._id = id
      ids.push(id)
      valuesv.push(id)
      valuesv.push(doc)
      valuesq.push('($' + j + ',' + '$' + (j+1) + ')')
    }

    return this.wait.then(function () {
      sql = "INSERT INTO pgjson.main (id, doc) VALUES " + valuesq.join(',')
      return db.none(sql, valuesv)
    }).then(function () {
      return {ok: true, ids: ids}
    }).catch(handle('problem posting docs'))
  }

  pgjson.prototype.put = function (doc) {
    var db = this.db

    return this.wait.then(function () {
      return db.query('SELECT pgjson.upsert($1, $2::jsonb)', [doc._id, doc])
    })
    .then(function () {
      return {ok: true, id: doc._id}
    })
    .catch(handle('problem putting doc'))
  }

  pgjson.prototype.get = function (id) {
    if (Array.isArray(id)) {
      return pgjson.prototype.getBulk.apply(this, arguments)
    }

    var db = this.db
    return this.wait.then(function () {
      return db.oneOrNone('SELECT doc FROM pgjson.main WHERE id = $1', [id])
    })
    .then(function (row) {
      return row ? row.doc : null
    })
    .catch(handle('problem getting doc'))
  }

  pgjson.prototype.getBulk = function (ids) {
    var db = this.db

    return this.wait.then(function () {
      return db.many('SELECT doc FROM unnest(ARRAY[$1]) WITH ORDINALITY AS u(id, ord) LEFT JOIN pgjson.main AS m ON m.id = u.id ORDER BY u.ord', [ids])
    })
    .then(function (rows) {
      return rows.map(function (r) { return r.doc })
    })
    .catch(handle('problem getting docs'))
  }

  pgjson.prototype.del = function (id) {
    var db = this.db
    return this.wait.then(function () {
      if (Array.isArray(id)) {
        return db.none('DELETE FROM pgjson.main WHERE id = ANY ($1)', [id])
      }
      return db.none('DELETE FROM pgjson.main WHERE id = $1', [id])
    })
    .then(function () {
      return {ok: true}
    })
    .catch(handle('problem deleting doc'))
  }

  pgjson.prototype.query = function (opts) {
    opts = opts || {}
    var o = opts.orderby
    var r = opts.descending ? 'DESC' : 'ASC'
    var l = opts.limit || 1000
    var f = opts.offset || 0

    var db = this.db
    return this.wait.then(function () {
      if (opts.orderby) {
        var terms = o.split(/[\.[]/).map(function (t) {
          if (t.slice(-1)[0] == ']') {
            t = t.slice(0, -1)
            if (!isNaN(parseInt(t))) {
              return t
            }
          }
          return "'" + t + "'"
        })
        var criteria = terms.join('->')
        return db.manyOrNone("SELECT doc FROM pgjson.main ORDER BY doc->" + criteria + ' ' + r + ", doc->'_id' " + r + " LIMIT $1 OFFSET $2", [l, f])
      }
      return db.manyOrNone('SELECT doc FROM pgjson.main ORDER BY id LIMIT $1 OFFSET $2', [l, f])
    })
    .then(function (rows) {
      return rows.map(function (r) { return r.doc })
    })
  }

  pgjson.prototype.count = function () {
    var db = this.db

    return this.wait.then(function () {
      return db.one('SELECT count(*) AS c FROM pgjson.main')
    })
    .then(function (row) {
      return row.c
    })
    .catch(handle('problem counting docs'))
  }

  pgjson.prototype.listIds = function () {
    var db = this.db

    return this.wait.then(function () {
      return db.query('SELECT id FROM pgjson.main')
    })
    .then(function (rows) {
      return rows.map(function (r) { return r.id })
    })
    .catch(handle('problem listing ids'))
  }

  pgjson.prototype.init = function () {
    var db = this.db

    this.wait = this.wait.then(function () {
      return db.query('CREATE SCHEMA IF NOT EXISTS pgjson')
    }).then(function () {
      return db.query('CREATE TABLE IF NOT EXISTS pgjson.main ( id text PRIMARY KEY, doc jsonb )')
    })
    .then(function () {
      return db.query(
        'CREATE OR REPLACE FUNCTION pgjson.upsert(key text, data jsonb) \n\
        RETURNS VOID AS \n\
        $$ \n\
        BEGIN \n\
            LOOP \n\
                UPDATE pgjson.main SET doc = data WHERE id = key; \n\
                IF found THEN \n\
                    RETURN; \n\
                END IF; \n\
                BEGIN \n\
                    INSERT INTO pgjson.main(id, doc) VALUES (key, data); \n\
                    RETURN; \n\
                EXCEPTION WHEN unique_violation THEN \n\
                END; \n\
            END LOOP; \n\
        END; \n\
        $$ \n\
        LANGUAGE plpgsql \n\
        '
      )
    })
    .catch(handle('could not initialize pgjson schema, table and functions'))

    return this.wait
  }

  pgjson.prototype.purgeAll = function () {
    var db = this.db

    this.wait = this.wait.then(function () {
      return db.query('DROP SCHEMA pgjson CASCADE')
    })
    .catch(handle('problem purging schema'))

    return this.wait
  }

  return pgjson
})()

module.exports = pgjson
