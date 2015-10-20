var assert = require('chai').assert
var Promise = require('lie')
var cuid = require('cuid')
var PGJSON = require('..')

describe('CRUD', function () {
  var pj

  before(function () {
    pj = new PGJSON(process.env.TEST_DATABASE_URL)
  })

  beforeEach(function () {
    pj.purgeAll()
    pj.init()
  })

  describe('post', function () {
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
  })

})
