// Proves both Nest modules resolve their client from dist/cjs, sync and async,
// and that the client is usable (auth wired, request reaches fetch).
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { Module, Injectable, Inject } = require('@nestjs/common');
const fh = require('../dist/cjs/fileharbor/nest/index.js');
const ar = require('../dist/cjs/articuno/nest/index.js');

const calls = [];
const fetch = async (url, init) => {
  calls.push({ url, headers: init.headers });
  return new Response('{}', { status: 200 });
};

class Consumer {
  constructor(fileharbor, articuno) {
    this.fileharbor = fileharbor;
    this.articuno = articuno;
  }
}
Inject(fh.FileHarborClient)(Consumer, undefined, 0);
Inject(ar.ArticunoClient)(Consumer, undefined, 1);
Injectable()(Consumer);

class Root {}
Module({
  imports: [
    fh.HeyAtomFileHarborModule.forRoot({ baseUrl: 'http://fileharbor.invalid', auth: fh.apiKeyAuth('fh-key'), fetch }),
    ar.HeyAtomArticunoModule.forRootAsync({
      useFactory: async () => ({ baseUrl: 'http://articuno.invalid', auth: ar.apiKeyAuth('tenant-key'), fetch }),
    }),
  ],
  providers: [Consumer],
})(Root);

NestFactory.createApplicationContext(Root, { logger: false })
  .then(async (app) => {
    const consumer = app.get(Consumer);
    if (!(consumer.fileharbor instanceof fh.FileHarborClient)) throw new Error('FileHarborClient unresolved');
    if (!(consumer.articuno instanceof ar.ArticunoClient)) throw new Error('ArticunoClient unresolved');
    await consumer.fileharbor.getClientStats();
    await consumer.articuno.listCategories();
    if (calls[0].headers['X-API-Key'] !== 'fh-key' || calls[1].headers['X-API-Key'] !== 'tenant-key') {
      throw new Error(`auth not wired: ${JSON.stringify(calls)}`);
    }
    console.log('DI smoke ok: FileHarborClient and ArticunoClient resolved from dist/cjs');
    return app.close();
  })
  .catch((err) => { console.error(err); process.exit(1); });
