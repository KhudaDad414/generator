/* eslint-disable sonarjs/no-duplicate-string */
const fs = require('fs');
const path = require('path');
const Generator = require('../lib/generator');
const log = require('loglevel');
const unixify = require('unixify');

const dummyYAML = fs.readFileSync(path.resolve(__dirname, './docs/dummy.yml'), 'utf8');

jest.mock('../lib/utils');
jest.mock('../lib/filtersRegistry');
jest.mock('../lib/hooksRegistry');
jest.mock('../lib/templateConfigValidator');

describe('Generator', () => {
  describe('constructor', () => {
    it('works with minimum amount of params', () => {
      const gen = new Generator('testTemplate', __dirname);
      expect(gen.templateName).toStrictEqual('testTemplate');
      expect(gen.targetDir).toStrictEqual(__dirname);
      expect(gen.entrypoint).toStrictEqual(undefined);
      expect(gen.noOverwriteGlobs).toStrictEqual([]);
      expect(gen.disabledHooks).toStrictEqual({});
      expect(gen.output).toStrictEqual('fs');
      expect(gen.forceWrite).toStrictEqual(false);
      expect(gen.install).toStrictEqual(false);
      expect(gen.templateParams).toStrictEqual({});
    });

    it('works with all the params', () => {
      const gen = new Generator('testTemplate', __dirname, {
        entrypoint: 'test-entrypoint',
        noOverwriteGlobs: ['test-globs'],
        disabledHooks: { 'test-hooks': true, 'generate:after': ['foo', 'bar'], foo: 'bar' },
        output: 'string',
        forceWrite: true,
        install: true,
        templateParams: {
          test: true,
        },
      });
      expect(gen.templateName).toStrictEqual('testTemplate');
      expect(gen.targetDir).toStrictEqual(__dirname);
      expect(gen.entrypoint).toStrictEqual('test-entrypoint');
      expect(gen.noOverwriteGlobs).toStrictEqual(['test-globs']);
      expect(gen.disabledHooks).toStrictEqual({ 'test-hooks': true, 'generate:after': ['foo', 'bar'], foo: 'bar' });
      expect(gen.output).toStrictEqual('string');
      expect(gen.forceWrite).toStrictEqual(true);
      expect(gen.install).toStrictEqual(true);
      expect(() => gen.templateParams.test).toThrow('Template parameter "test" has not been defined in the package.json file under generator property. Please make sure it\'s listed there before you use it in your template.');

      // Mock params on templateConfig so it doesn't fail.
      gen.templateConfig.parameters = { test: {} };

      expect(gen.templateParams.test).toStrictEqual(true);
    });

    it('throws an error indicating an unexpected param was given', () => {
      const t = () => new Generator('testTemplate', __dirname, {
        entrypoint: 'test-entrypoint',
        noOverwriteGlobs: ['test-globs'],
        disabledHooks: { 'test-hooks': true },
        output: 'string',
        forceWrite: true,
        forceInstall: true,
        templateParams: {
          test: true,
        }
      });
      expect(t).toThrow('These options are not supported by the generator: forceInstall');
    });

    it('throws an error indicating multiple unexpected params were given', () => {
      const t = () => new Generator('testTemplate', __dirname, {
        entrypoint: 'test-entrypoint',
        noOverwriteGlobs: ['test-globs'],
        disabledHooks: { 'test-hooks': true },
        output: 'string',
        write: true,
        forceInstall: true,
        templateParams: {
          test: true,
        }
      });
      expect(t).toThrow('These options are not supported by the generator: write, forceInstall');
    });

    it('fails if no templateName is given', () => {
      const t = () => new Generator();
      expect(t).toThrow('No template name has been specified.');
    });

    it('fails if no targetDir is given', () => {
      const t = () => new Generator('testTemplate');
      expect(t).toThrow('No target directory has been specified.');
    });

    it('fails if output is given and is different than "fs" and "string"', () => {
      const t = () => new Generator('testTemplate', __dirname, { output: 'fail' });
      expect(t).toThrow('Invalid output type fail. Valid values are \'fs\' and \'string\'.');
    });
  });

  describe('#generate', () => {
    let asyncApiDocumentMock;
    let xfsMock;
    let util;
    let filtersRegistry;
    let hooksRegistry;
    let templateConfigValidator;

    const mockMethods = (gen) => {
      gen.verifyTargetDir = jest.fn();
      gen.installTemplate = jest.fn().mockResolvedValue({ name: 'nameOfTestTemplate', path: '/path/to/template/nameOfTestTemplate' });
      gen.configureTemplate = jest.fn();
      gen.loadTemplateConfig = jest.fn();
      gen.registerHooks = jest.fn();
      gen.registerFilters = jest.fn();
      gen.validateTemplateConfig = jest.fn();
      gen.generateDirectoryStructure = jest.fn();
      gen.launchHook = jest.fn();
      gen.generateFile = jest.fn();
      gen.renderString = jest.fn();
    };

    beforeAll(() => {
      util = require('../lib/utils');
      filtersRegistry = require('../lib/filtersRegistry');
      hooksRegistry = require('../lib/hooksRegistry');
      templateConfigValidator = require('../lib/templateConfigValidator');
      xfsMock = require('fs.extra');
      const parserMock = require('@asyncapi/parser');
      asyncApiDocumentMock = new parserMock.AsyncAPIDocument();
    });

    it('works with output=fs, forceWrite=false, install=false', async () => {
      const gen = new Generator('testTemplate', __dirname);
      mockMethods(gen);
      await gen.generate(asyncApiDocumentMock);

      expect(xfsMock.mkdirpSync).toHaveBeenCalledWith(__dirname);
      expect(gen.verifyTargetDir).toHaveBeenCalledWith(__dirname);
      expect(gen.installTemplate).toHaveBeenCalledWith(false);
      expect(gen.loadTemplateConfig).toHaveBeenCalled();
      expect(gen.configureTemplate).toHaveBeenCalled();
      expect(hooksRegistry.registerHooks).toHaveBeenCalled();
      expect(filtersRegistry.registerFilters).toHaveBeenCalled();
      expect(templateConfigValidator.validateTemplateConfig).toHaveBeenCalled();
      expect(gen.generateDirectoryStructure).toHaveBeenCalledWith(asyncApiDocumentMock);
      expect(gen.launchHook).toHaveBeenCalledWith('generate:after');

      expect(util.exists).toHaveBeenCalledTimes(0);
      expect(util.readFile).toHaveBeenCalledTimes(0);
      expect(gen.generateFile).toHaveBeenCalledTimes(0);
      expect(gen.renderString).toHaveBeenCalledTimes(0);
    });

    it('works with output=fs, forceWrite=false, install=true', async () => {
      const gen = new Generator('testTemplate', __dirname, { install: true });
      mockMethods(gen);
      await gen.generate(asyncApiDocumentMock);

      expect(xfsMock.mkdirpSync).toHaveBeenCalledWith(__dirname);
      expect(gen.verifyTargetDir).toHaveBeenCalledWith(__dirname);
      expect(gen.installTemplate).toHaveBeenCalledWith(true);
      expect(gen.loadTemplateConfig).toHaveBeenCalled();
      expect(gen.configureTemplate).toHaveBeenCalled();
      expect(hooksRegistry.registerHooks).toHaveBeenCalled();
      expect(filtersRegistry.registerFilters).toHaveBeenCalled();
      expect(templateConfigValidator.validateTemplateConfig).toHaveBeenCalled();
      expect(gen.generateDirectoryStructure).toHaveBeenCalledWith(asyncApiDocumentMock);
      expect(gen.launchHook).toHaveBeenCalledWith('generate:after');

      expect(util.exists).toHaveBeenCalledTimes(0);
      expect(util.readFile).toHaveBeenCalledTimes(0);
      expect(gen.generateFile).toHaveBeenCalledTimes(0);
      expect(gen.renderString).toHaveBeenCalledTimes(0);
    });

    it('works with output=fs, forceWrite=true, install=false', async () => {
      const gen = new Generator('testTemplate', __dirname, { forceWrite: true });
      mockMethods(gen);
      await gen.generate(asyncApiDocumentMock);

      expect(xfsMock.mkdirpSync).toHaveBeenCalledWith(__dirname);
      expect(gen.installTemplate).toHaveBeenCalledWith(false);
      expect(gen.configureTemplate).toHaveBeenCalled();
      expect(hooksRegistry.registerHooks).toHaveBeenCalled();
      expect(filtersRegistry.registerFilters).toHaveBeenCalled();
      expect(templateConfigValidator.validateTemplateConfig).toHaveBeenCalled();
      expect(gen.generateDirectoryStructure).toHaveBeenCalledWith(asyncApiDocumentMock);
      expect(gen.launchHook).toHaveBeenCalledWith('generate:after');

      expect(util.exists).toHaveBeenCalledTimes(0);
      expect(util.readFile).toHaveBeenCalledTimes(0);
      expect(gen.verifyTargetDir).toHaveBeenCalledTimes(0);
      expect(gen.generateFile).toHaveBeenCalledTimes(0);
      expect(gen.renderString).toHaveBeenCalledTimes(0);
    });

    it('works with output=fs, forceWrite=true, install=true', async () => {
      const gen = new Generator('testTemplate', __dirname, { forceWrite: true, install: true });
      mockMethods(gen);
      await gen.generate(asyncApiDocumentMock);

      expect(xfsMock.mkdirpSync).toHaveBeenCalledWith(__dirname);
      expect(gen.installTemplate).toHaveBeenCalledWith(true);
      expect(gen.loadTemplateConfig).toHaveBeenCalled();
      expect(gen.loadTemplateConfig).toHaveBeenCalled();
      expect(hooksRegistry.registerHooks).toHaveBeenCalled();
      expect(filtersRegistry.registerFilters).toHaveBeenCalled();
      expect(templateConfigValidator.validateTemplateConfig).toHaveBeenCalled();
      expect(gen.generateDirectoryStructure).toHaveBeenCalledWith(asyncApiDocumentMock);
      expect(gen.launchHook).toHaveBeenCalledWith('generate:after');

      expect(util.exists).toHaveBeenCalledTimes(0);
      expect(util.readFile).toHaveBeenCalledTimes(0);
      expect(gen.verifyTargetDir).toHaveBeenCalledTimes(0);
      expect(gen.generateFile).toHaveBeenCalledTimes(0);
      expect(gen.renderString).toHaveBeenCalledTimes(0);
    });

    it('works with output=fs, forceWrite=false, install=false, entrypoint=set', async () => {
      const gen = new Generator('testTemplate', __dirname, { entrypoint: 'file.js' });
      mockMethods(gen);
      util.exists.mockResolvedValue(true);
      await gen.generate(asyncApiDocumentMock);

      expect(xfsMock.mkdirpSync).toHaveBeenCalledWith(__dirname);
      expect(gen.verifyTargetDir).toHaveBeenCalledWith(__dirname);
      expect(gen.installTemplate).toHaveBeenCalledWith(false);
      expect(gen.loadTemplateConfig).toHaveBeenCalled();
      expect(gen.loadTemplateConfig).toHaveBeenCalled();
      expect(hooksRegistry.registerHooks).toHaveBeenCalled();
      expect(filtersRegistry.registerFilters).toHaveBeenCalled();
      expect(templateConfigValidator.validateTemplateConfig).toHaveBeenCalled();
      expect(gen.launchHook).toHaveBeenCalledWith('generate:after');
      expect(unixify(util.exists.mock.calls[0][0])).toEqual('/path/to/template/nameOfTestTemplate/template/file.js');
      expect(gen.generateFile.mock.calls[0][0]).toEqual(asyncApiDocumentMock);
      expect(gen.generateFile.mock.calls[0][1]).toEqual('file.js');
      expect(unixify(gen.generateFile.mock.calls[0][2])).toEqual('/path/to/template/nameOfTestTemplate/template');
      expect(util.readFile).toHaveBeenCalledTimes(0);
      expect(gen.renderString).toHaveBeenCalledTimes(0);
      expect(gen.generateDirectoryStructure).toHaveBeenCalledTimes(0);
    });
  });

  describe('#generateFromString', () => {
    let generateMock;
    let parserMock;

    beforeAll(() => {
      parserMock = require('@asyncapi/parser');
      generateMock = jest.fn().mockResolvedValue();
    });

    it('calls parser.parse and this.generate', async () => {
      const gen = new Generator('testTemplate', __dirname);
      gen.generate = generateMock;
      await gen.generateFromString(dummyYAML);

      expect(generateMock).toHaveBeenCalled();
      expect(parserMock.parse).toHaveBeenCalled();
      expect(parserMock.parse.mock.calls[0][0]).toBe(dummyYAML);
      expect(parserMock.parse.mock.calls[0][1]).toStrictEqual({});
    });

    it('calls parser.parse with the right options', async () => {
      const gen = new Generator('testTemplate', __dirname);
      const fakeOptions = { test: true };
      gen.generate = generateMock;
      await gen.generateFromString(dummyYAML, fakeOptions);

      expect(parserMock.parse).toHaveBeenCalled();
      expect(parserMock.parse.mock.calls[0][0]).toBe(dummyYAML);
      expect(parserMock.parse.mock.calls[0][1]).toStrictEqual(fakeOptions);
    });

    it('fails if asyncapiString is not provided', async () => {
      const gen = new Generator('testTemplate', __dirname);
      gen.generate = generateMock;
      expect(() => gen.generateFromString()).rejects.toThrow('Parameter "asyncapiString" must be a non-empty string.');
    });

    it('fails if asyncapiString is not a string', async () => {
      const gen = new Generator('testTemplate', __dirname);
      gen.generate = generateMock;
      expect(() => gen.generateFromString(1)).rejects.toThrow('Parameter "asyncapiString" must be a non-empty string.');
    });

    it('stores the original asyncapi document', async () => {
      const gen = new Generator('testTemplate', __dirname);
      gen.generate = generateMock;
      await gen.generateFromString(dummyYAML);
      expect(gen.originalAsyncAPI).toBe(dummyYAML);
    });
  });

  describe('#generateFromFile', () => {
    it('calls readFile and generateFromString with the right params', async () => {
      const utils = require('../lib/utils');
      const filePath = 'fake-asyncapi.yml';
      utils.__files = {
        [filePath]: 'test content',
      };
      const generateFromStringMock = jest.fn().mockResolvedValue();
      const gen = new Generator('testTemplate', __dirname);
      gen.generateFromString = generateFromStringMock;
      await gen.generateFromFile(filePath);
      expect(utils.readFile).toHaveBeenCalled();
      expect(utils.readFile.mock.calls[0][0]).toBe(filePath);
      expect(utils.readFile.mock.calls[0][1]).toStrictEqual({ encoding: 'utf8' });
      expect(generateFromStringMock.mock.calls[0][0]).toBe('test content');
      expect(generateFromStringMock.mock.calls[0][1]).toStrictEqual({ path: filePath });
    });
  });

  describe('#generateFromURL', () => {
    it('calls fetch and generateFromString with the right params', async () => {
      const utils = require('../lib/utils');
      const asyncapiURL = 'http://example.com/fake-asyncapi.yml';
      utils.__contentOfFetchedFile = 'fake text';
      
      const generateFromStringMock = jest.fn().mockResolvedValue();
      const gen = new Generator('testTemplate', __dirname);
      gen.generateFromString = generateFromStringMock;
      await gen.generateFromURL(asyncapiURL);
      expect(utils.fetchSpec).toHaveBeenCalled();
      expect(utils.fetchSpec.mock.calls[0][0]).toBe(asyncapiURL);
      expect(generateFromStringMock.mock.calls[0][0]).toBe('fake text');
    });
  });

  describe('#installTemplate', () => {
    let ArboristMock;
    let arboristMock;
    let utils;

    beforeEach(() => {
      ArboristMock = require('@npmcli/arborist');
      arboristMock = new ArboristMock();
      utils = require('../lib/utils');
      jest.mock(path.resolve('./testTemplate', 'package.json'), () => ({ name: 'nameOfTestTemplate' }), { virtual: true });
      jest.mock(path.resolve(Generator.DEFAULT_TEMPLATES_DIR, 'nameOfTestTemplate', 'package.json'), () => ({ name: 'nameOfTestTemplate' }), { virtual: true });
    });

    it('works with a file system path', async () => {
      log.debug = jest.fn();
      utils.__getTemplateDetails = { pkgPath: '/path', name: 'test-template' };
      const templatePath = './testTemplate';
      const gen = new Generator(templatePath, __dirname);
      await gen.installTemplate();
      setTimeout(() => { // This puts the call at the end of the Node.js event loop queue.
        expect(arboristMock.reify).toHaveBeenCalledTimes(0);
      }, 0);
    });

    it('works with a file system path and force = true', async () => {
      const gen = new Generator('./testTemplate', __dirname);
      await gen.installTemplate(true);
      setTimeout(() => { // This puts the call at the end of the Node.js event loop queue.
        expect(arboristMock.reify).toHaveBeenCalledTimes(1);
        expect(arboristMock.reify.mock.calls[0][0]).toStrictEqual({
          add: ['./testTemplate'],
          saveType: 'prod',
          save: false
        });
      }, 0);
    });
    it('works with an npm package', async () => {
      utils.__isFileSystemPathValue = false;
      const gen = new Generator('nameOfTestTemplate', __dirname);
      await gen.installTemplate();
      setTimeout(() => { // This puts the call at the end of the Node.js event loop queue.
        expect(arboristMock.reify).toHaveBeenCalledTimes(0);
      }, 0);
    });

    it('works with an npm package that is installed for the first time', async () => {
      log.debug = jest.fn();
      utils.__getTemplateDetails = undefined;
      const gen = new Generator('nameOfTestTemplate', __dirname, {debug: true});
      await gen.installTemplate();
      expect(log.debug).toHaveBeenCalledWith('Template installation started because the template cannot be found on disk');
      setTimeout(() => { // This puts the call at the end of the Node.js event loop queue.
        expect(arboristMock.reify).toHaveBeenCalledTimes(1);
      }, 0);
    });

    it('works with an npm package and force = true', async () => {
      log.debug = jest.fn();
      utils.__isFileSystemPathValue = false;
      const gen = new Generator('nameOfTestTemplate', __dirname);
      await gen.installTemplate(true);
      expect(log.debug).toHaveBeenCalledWith('Template installation started because you passed --install flag');
      setTimeout(() => { // This puts the call at the end of the Node.js event loop queue.
        expect(arboristMock.reify).toHaveBeenCalledTimes(1);
      }, 0);
    });

    it('works with a url', async () => {
      utils.__isFileSystemPathValue = false;
      utils.__getTemplateDetails = undefined;
      const gen = new Generator('https://my-test-template.com', __dirname);
      await gen.installTemplate();
      setTimeout(() => { // This puts the call at the end of the Node.js event loop queue.
        expect(arboristMock.reify).toHaveBeenCalledTimes(1);
      }, 0);
    });

    it('works with a url and force = true', async () => {
      const gen = new Generator('https://my-test-template.com', __dirname);
      await gen.installTemplate(true);
      setTimeout(() => { // This puts the call at the end of the Node.js event loop queue.
        expect(arboristMock.reify).toHaveBeenCalledTimes(1);
      }, 0);
    });
  });

  describe('.getTemplateFile', () => {
    it('retrieves the content of a template file', async () => {
      const utils = require('../lib/utils');
      const filePath = path.resolve(Generator.DEFAULT_TEMPLATES_DIR, 'simple', 'template/static.md');
      utils.__files = {
        [filePath]: 'test content',
      };
      const content = await Generator.getTemplateFile('simple', 'template/static.md');
      expect(utils.readFile).toHaveBeenCalled();
      expect(utils.readFile.mock.calls[0][0]).toBe(filePath);
      expect(content).toBe(utils.__files[filePath]);
    });

    it('retrieves the content of a template file overriding the default template dir', async () => {
      const utils = require('../lib/utils');
      const filePath = path.resolve('~', 'templates', 'simple', 'template/static.md');
      utils.__files = {
        [filePath]: 'test content',
      };
      const content = await Generator.getTemplateFile('simple', 'template/static.md', path.resolve('~', 'templates'));
      expect(utils.readFile).toHaveBeenCalled();
      expect(utils.readFile.mock.calls[0][0]).toBe(filePath);
      expect(content).toBe(utils.__files[filePath]);
    });
  });

  describe('#loadDefaultValues', () => {
    it('default value of parameter is set', async () => {
      const gen = new Generator('testTemplate', __dirname, {
        templateParams: {
          test: true
        }
      });
      gen.templateConfig  = {
        parameters: {
          paramWithDefault: {
            description: 'Parameter with default value',
            default: 'default',
            required: false
          },
          paramWithoutDefault: {
            description: 'Parameter without default value',
            required: false
          },
          test: {
            description: 'test',
            required: false
          }
        }
      };

      await gen.loadDefaultValues();

      expect(gen.templateParams).toStrictEqual({
        test: true,
        paramWithDefault: 'default'
      });
    });

    it('default value of parameter is not override user value', async () => {
      const gen = new Generator('testTemplate', __dirname, {
        templateParams: {
          test: true
        }
      });
      gen.templateConfig = {
        parameters: {
          test: {
            description: 'Parameter with default value',
            default: false,
            required: false
          }
        }
      };

      await gen.loadDefaultValues();

      expect(gen.templateParams).toStrictEqual({
        test: true
      });
    });

    it('no default values', async () => {
      const gen = new Generator('testTemplate', __dirname, {
        templateParams: {
          test: true
        }
      });
      gen.templateConfig = {
        parameters: {
          test: {
            description: 'Parameter with default value',
            required: false
          },
          anotherParam: {
            description: 'Yeat another param',
            required: false
          }
        }
      };

      await gen.loadDefaultValues();

      expect(gen.templateParams).toStrictEqual({
        test: true
      });
    });
  });

  describe('#launchHook', () => {
    it('launch given hook', async () => {
      let iteration = 0;
      const gen = new Generator('testTemplate', __dirname);
      gen.hooks = { 'test-hooks': [function a() { iteration++; }, function b() { iteration++; }] };
      await gen.launchHook('test-hooks');
      expect(iteration).toStrictEqual(2);
    });

    it('launch given hook which is disabled', async () => {
      let iteration = 0;
      const gen = new Generator('testTemplate', __dirname, { disabledHooks: { 'test-hooks': true } });
      gen.hooks = { 'test-hooks': [function a() { iteration++; }, function b() { iteration++; }] };
      await gen.launchHook('test-hooks');
      expect(iteration).toStrictEqual(0);
    });

    it('launch given hook where disabledHooks key has array format for given hook type', async () => {
      let iteration = 0;
      const gen = new Generator('testTemplate', __dirname, { disabledHooks: { 'test-hooks': ['a', 'b'] } });
      gen.hooks = { 'test-hooks': [function a() { iteration++; }, function b() { iteration++; }, function c() { iteration++; }] };
      await gen.launchHook('test-hooks');
      expect(iteration).toStrictEqual(1);
    });

    it('launch given hook where disabledHooks key has array format for given hook type', async () => {
      let iteration = 0;
      const gen = new Generator('testTemplate', __dirname, { disabledHooks: { 'test-hooks': 'c' } });
      gen.hooks = { 'test-hooks': [function a() { iteration++; }, function b() { iteration++; }, function c() { iteration++; }] };
      await gen.launchHook('test-hooks');
      expect(iteration).toStrictEqual(2);
    });
  });

  describe('#isHookAvailable', () => {
    it('given hook type not exist or has empty array', async () => {
      const gen = new Generator('testTemplate', __dirname);
      gen.hooks = { 'test-hooks': [] };
      expect(gen.isHookAvailable('foo-bar')).toStrictEqual(false);
      expect(gen.isHookAvailable('test-hooks')).toStrictEqual(false);
    });

    it('given hook type exist and has hooks', async () => {
      const gen = new Generator('testTemplate', __dirname);
      gen.hooks = { 'test-hooks': ['foo-bar'] };
      expect(gen.isHookAvailable('test-hooks')).toStrictEqual(true);
    });

    it('given hook type is disabled', async () => {
      const gen = new Generator('testTemplate', __dirname, { disabledHooks: { 'test-hooks': true } });
      gen.hooks = { 'test-hooks': ['foo-bar'] };
      expect(gen.isHookAvailable('test-hooks')).toStrictEqual(false);
    });

    it('for given hook type only some hooks are disabled', async () => {
      const gen = new Generator('testTemplate', __dirname, { disabledHooks: { 'test-hooks': ['fooBar'], 'string-test-hooks': 'fooBar' } });
      gen.hooks = { 'test-hooks': [function fooBar() {}, function barFoo() {}], 'string-test-hooks': [function fooBar() {}, function barFoo() {}] };
      expect(gen.isHookAvailable('test-hooks')).toStrictEqual(true);
      expect(gen.isHookAvailable('string-test-hooks')).toStrictEqual(true);
    });

    it('for given hook type whole hooks are disabled', async () => {
      const gen = new Generator('testTemplate', __dirname, { disabledHooks: { 'test-hooks': ['fooBar', 'barFoo'], 'string-test-hooks': 'fooBar' } });
      gen.hooks = { 'test-hooks': [function fooBar() {}, function barFoo() {}], 'string-test-hooks': [function fooBar() {}] };
      expect(gen.isHookAvailable('test-hooks')).toStrictEqual(false);
      expect(gen.isHookAvailable('string-test-hooks')).toStrictEqual(false);
    });
  });
});
