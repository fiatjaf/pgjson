var Promise = require('lie')
var cuid = require('cuid')
var utils = require('./utils')

var pgp = require('pg-promise')({
  promiseLib: Promise,
  query: process.env.DEBUG ? function (e) { console.log(e.query) } : undefined
})

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
    var values = docs.map(function (doc) {
      var id = cuid()
      ids.push(id)
      doc._id = id
      return pgp.as.format("($1, $2)", [id, doc])
    }).join(',')
    return this.wait.then(function () {
      return db.none("INSERT INTO pgjson.main (id, doc) VALUES $1^", values)
    }).then(function () {
      return {ok: true, ids: ids}
    }).catch(handle('problem posting docs'))
  }

  pgjson.prototype.put = function (doc) {
    var db = this.db

    return this.wait.then(function () {
      return db.func('pgjson.upsert', [doc._id, doc])
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
      return db.many('SELECT doc FROM unnest($1) WITH ORDINALITY AS u(id, ord) LEFT JOIN pgjson.main AS m ON m.id = u.id ORDER BY u.ord', [ids])
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
    var db = this.db
    return this.wait.then(function () {
      var params = {
        limit: opts.limit || 1000,
        offset: opts.offset || 0,
        order: opts.descending ? 'DESC' : 'ASC',
        criteria: "'_id'",
        where: "'1'",
        condition: '1'
      }

      // orderby
      if (opts.orderby) {
        params.criteria = utils.dotToPostgresJSON(opts.orderby)
      }

      // filter
      if (opts.filter) {
        var expr = opts.filter.split('=')
        params.where = pgp.as.format('doc->$1^', utils.dotToPostgresJSON(expr[0].trim()))
        params.condition = JSON.stringify(JSON.parse(expr[1].trim()))
      }

      return db.any("SELECT doc FROM pgjson.main WHERE ${where^} = ${condition} ORDER BY doc->${criteria^} ${order^}, doc->'_id' ${order^} LIMIT ${limit} OFFSET ${offset}", params)
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
      return db.any('SELECT id FROM pgjson.main')
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
