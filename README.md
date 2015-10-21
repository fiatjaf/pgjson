# PGJSON: start saving data to Postgres without thinking about schema

Welcome to PGJSON!

[![Build Status](https://travis-ci.org/fiatjaf/pgjson.svg?branch=master)](https://travis-ci.org/fiatjaf/pgjson)
[![NPM Link](https://nodei.co/npm/pgjson.png)](https://npmjs.com/pgjson)

```javascript
var db = new (require('pgjson'))('postgres:///db')

Promise.resolve().then(function () {
  return db.post({
    name: 'tomato',
    uses: ['tomato juice']
  })
})
.then(function (res) {
  console.log(res) /* {ok: true, id: 'xwkfi23syw'} */
  return db.get('xwkfi23syw')
})
.then(function (doc) {
  console.log(doc) /* {_id: 'xwkfi23syw', name: 'tomato', uses: ['tomato juice']} */
  doc.uses.push('ketchup')
  doc.colour = 'red'
  return db.put(doc)
})
.then(function (res) {
  console.log(res) /* {ok: true, id: 'xwkfi23syw'} */
  db.del(doc._id)
})
.catch(console.log.bind(console))
```

In the meantime:

```sql
postgres=> SELECT * FROM pgjson.main;
     id     |                                doc
------------+-------------------------------------------------------------------
 xwkfi23syw | {"_id": "xwkfi23syw", "name": "tomato", "uses": ["tomato juice"]}
(1 row)
postgres=>
postgres=> SELECT * FROM pgjson.main;
     id     |                                doc
------------+-------------------------------------------------------------------
 xwkfi23syw | {"_id": "xwkfi23syw", "name": "tomato", "uses": ["tomato juice", "ketchup"], "colour": "red"}
(1 row)
postgres=>
```

Basically this.

Which means you can use this same data later, create indexes on specific JSON fields, easily migrate the data to other table structure, create views or materialized views.

---

## API

### new PGJSON(options): DB

`options` is anything [pg](https://github.com/brianc/node-postgres/wiki/Client#constructors) can take: a connection string, a domain socket folder or a config object. See the link for more details.

### DB.get(string): Promise -> doc

accepts the id of some document as a parameter and returns a promise for the raw stored JSON document. If the document is not found the promise resolves to `null`.

### DB.post(object): Promise -> response

accepts an object, saves it with a random `._id` and returns a promise for a response which will contain `{ok: true, id: <the random id>}`. If the passed object has an `_id` property it will be discarded.

### DB.put(document): Promise -> response

same as .post, but instead of creating a new document with a random id, this expects a complete _document_, which is to say an object with an `_id` property. Updates (or creates, if none is found) the document with the specified id.

### DB.del(string): Promise -> response

accepts an id, as string. The response is an object of format `{ok: true}`.

### DB.allIds(): Promise -> array

returns a promise to an array of ids (strings) of all documents stored in the database.

### DB.count(): Promise -> integer

returns a promise to an integer with the count of all documents stored in the database.

### DB.purgeAll(): Promise -> null

deletes everything: table, rows, schema. This isn't supposed to be used.

### DB.init(): Promise -> null

creates a schema called _pgjson_, a table called _main_ and a function called _upsert_. This is idempotent and is called automatically when the DB is instantiated.
