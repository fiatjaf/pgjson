var assert = require('chai').assert
var Promise = require('bluebird')
var cuid = require('cuid')
var PGJSON = require('..')

describe('basic functions', function () {
  var pj

  before(function () {
    pj = new PGJSON(process.env.TEST_DATABASE_URL)
  })

  beforeEach(function () {
    pj.purgeAll()
    pj.init()
  })

  describe('CRUD', function () {
    it('should create a new doc', function (done) {
      pj.post({
        banana: 23,
        goiaba: ['3a4', {ra: 17}]
      }).then(function (res) {
        assert.equal(res.ok, true, 'post succeeded.')
        assert.lengthOf(res.id, cuid().length, 'generated id is a cuid.')
      }).then(done).catch(done)
    })

    it('should create and read docs', function (done) {
      var initial = {
        _id: 'goiabinha',
        uva: 41
      }
      pj.put(initial)
      .then(function (r) {
        assert.deepEqual(r, {ok: true, id: 'goiabinha'}, 'put succeeded.')
        return pj.get('goiabinha')
      }).then(function (doc) {
        assert.deepEqual(initial, doc, 'read after put succeeded.')
      }).then(done).catch(done)
    })

    it('should create, count, update, list and delete docs', function (done) {
      var banana = {cor: 'amarela'}
      var uva = {cor: 'grená'}

      pj.post(banana)
      .then(function (bu) {
        assert.deepEqual(banana, {
          cor: 'amarela',
          _id: bu.id
        })
        return pj.count()
      })
      .then(function (c) {
        assert.equal(c, 1)
        return pj.post(banana)
      })
      .then(function (bu) {
        var newbanana = {
          _id: bu.id,
          cor: 'amarela pintada',
          tipo: 'fruta',
          'açúcar': 26,
          faz: ['sorvete', 'bolo']
        }
        return pj.put(newbanana)
      })
      .then(function (bu) {
        return pj.get(bu.id)
      })
      .then(function (newbanana) {
        delete newbanana._id
        assert.deepEqual(newbanana, {
          cor: 'amarela pintada',
          tipo: 'fruta',
          'açúcar': 26,
          faz: ['sorvete', 'bolo']
        })
        return pj.post(uva)
      })
      .then(function () {
        return pj.count()
      })
      .then(function (c) {
        assert.equal(c, 3)
        return pj.listIds()
      })
      .then(function (ids) {
        return Promise.all(ids.map(function (id) {
          return pj.del(id)
        }))
      })
      .then(function (deletes) {
        deletes.forEach(function (d) {
          assert.equal(d.ok, true)
        })
        assert.lengthOf(deletes, 3, 'deleted everything correctly.')
      }).then(done).catch(done)
    })

    it('fetching inexistent doc', function (done) {
      pj.get('nothing')
      .then(function (doc) {
        assert.equal(doc, null)
      }).then(done).catch(done)
    })
  })

  describe('transactions', function () {
    it('should bulk create, then bulk fetch, then bulk delete', function (done) {
      var ids

      pj.post([{fruit: 'banana'}, {fruit: 'passion'}, {fruit: 'goiaba'}])
      .then(function (res) {
        assert.equal(res.ok, true)
        assert.equal(res.ids.length, 3, 'posted three docs at the same time and got three ids.')
        ids = res.ids
        return pj.get(res.ids)
      })
      .then(function (docs) {
        assert.equal(docs.length, 3)
        assert.deepEqual(docs.map(function (d) { return d.fruit }), ['banana', 'passion', 'goiaba'])
        assert.deepEqual(docs.map(function (d) { return d._id }), ids, 'successfully fetched the three docs in order')
        return pj.get([ids[0], 'none', ids[1]])
      })
      .then(function (docs) {
        assert.equal(docs[0].fruit, 'banana')
        assert.equal(docs[1], null, 'got null for a doc id which could not be found.')
        assert.equal(docs[2].fruit, 'passion')
        return pj.del(ids)
      })
      .then(function (deletes) {
        assert.equal(deletes.ok, true)
      }).then(done).catch(done)
    })
  })

  describe('fancy queries', function () {
    it('should fetch all docs, sorted by id', function (done) {
      Promise.all([{_id: 'b', word: 'banana'}, {_id: 'a', word: 'azul'}].map(function (doc) {
        return pj.put(doc)
      }))
      .then(function () {
        return pj.query()
      })
      .then(function (docs) {
        assert.deepEqual(docs, [{_id: 'a', word: 'azul'}, {_id: 'b', word: 'banana'}])
      }).then(done).catch(done)
    })

    it('should sort by any key and limit', function (done) {
      Promise.all([
        {_id: 'a', word: 'laranja', props: {coolness: 23}, j: false},
        {_id: 'b', word: 'arab', props: {coolness: 18}, letters: ['a', 'r']},
        {_id: 'c', word: 'laec', props: {}, j: false, letters: ['l', 'a']},
        {_id: 'd', word: 'jalad', j: true, letters: ['j', 'a']}
      ].map(function (doc) { return pj.put(doc) }))
      .then(function () {
        return pj.query({orderby: 'word'})
      })
      .then(function (docs) {
        var ids = docs.map(function (d) { return d._id })
        assert.deepEqual(ids, ['b', 'd', 'c', 'a'])
        return pj.query({orderby: 'props.coolness', limit: 3})
      })
      .then(function (docs) {
        var ids = docs.map(function (d) { return d._id })
        assert.deepEqual(ids, ['b', 'a', 'c'])
        return pj.query({orderby: 'j', descending: true, limit: 2, offset: 1})
      })
      .then(function (docs) {
        var ids = docs.map(function (d) { return d._id })
        assert.deepEqual(ids, ['d', 'c'])
        return pj.query({orderby: 'letters[1]', descending: true, offset: 3, limit: 2})
      })
      .then(function (docs) {
        var ids = docs.map(function (d) { return d._id })
        assert.deepEqual(ids, ['c'])
      }).then(done).catch(done)
    })

    it('should filter the docs based on some conditions', function (done) {
      Promise.all([
        {_id: 'a', word: 'laranja', props: {coolness: 23}, j: false},
        {_id: 'b', word: 'arab', props: {coolness: 18}, letters: ['a', 'r']},
        {_id: 'c', word: 'laec', props: {}, j: false, letters: ['l', 'a']},
        {_id: 'd', word: 'jalad', j: true, letters: ['j', 'a']},
        {_id: 'e', word: 'olie', props: {coolness: 18}, letters: ['r', 'l', 'y']},
      ].map(function (doc) { return pj.put(doc) }))
      .then(function () {
        return pj.query({filter: 'word = "laranja"'})
      })
      .then(function (docs) {
        var ids = docs.map(function (d) { return d._id })
        assert.deepEqual(ids, ['a'])
        return pj.query({filter: 'props.coolness = 18', orderby: 'letters[1]'})
      })
      .then(function (docs) {
        var ids = docs.map(function (d) { return d._id })
        assert.deepEqual(ids, ['e', 'b'])
        return pj.query({orderby: 'j', descending: true, filter: 'j = true'})
      })
      .then(function (docs) {
        var ids = docs.map(function (d) { return d._id })
        assert.deepEqual(ids, ['d'])
        return pj.query({filter: 'props = {"coolness": 23}'})
      })
      .then(function (docs) {
        var ids = docs.map(function (d) { return d._id })
        assert.deepEqual(ids, ['a'])
      }).then(done).catch(done)
    })
  })
})
