'use strict';

const FilePathBuilderService = require('../services/FilePathBuilderService.js');
const FileLoaderService = require('../services/FileLoaderService.js');
const Toolbox = require('../utils/Toolbox.js');

/**
 * This controller is for processing the requests and building the response
 */
class MockCtrl {
  /**
   * Constructor.
   */
  constructor({Configuration, Logger}) {
    this.Configuration = Configuration;
    this.Logger = Logger;

    this.pathBuilder = new FilePathBuilderService({Configuration, Logger});
    this.fileLoader = new FileLoaderService({Configuration, Logger});
  }

  /**
   * Build a response based on the user request.
   * @param request
   * @param response
   */
  buildResponse(request, response) {
    let method = request.method;
    let httpCode = 201;
    let responseHeaders = {};
    let rawContent = null;
    let extension = 'json';
    let location = null;
    let delay = 1;

    // Get the URL
    const url = Toolbox.removeTrailingSlash(request.url);
    responseHeaders['X-Mockiji-Url'] = url;
    this.Logger.info({
      'type': 'request',
      'method': method,
      'url': url
    }, `Received a request: "${method} ${url}"`);

    // List every possible paths
    let paths = this.pathBuilder.generatePaths(method.toLowerCase(), url);

    // Find the file to load and extract the content
    let fileToLoad = this.fileLoader.find(paths.mocks);

    if (fileToLoad !== null) {
      let fileData = this.fileLoader.load(fileToLoad, request, paths);
      rawContent = fileData.rawContent;
      httpCode = fileData.httpCode;
      extension = fileData.extension;
      location = fileData.location;
      delay = fileData.delay;
      responseHeaders['X-Mockiji-File'] = fileToLoad;
      responseHeaders['X-Mockiji-Notices'] = fileData.notices;
      responseHeaders['Cache-Control'] = 'no-cache';
      if (location) {
        responseHeaders['Location'] = location;
      }
    } else {
      httpCode = this.Configuration.get('http_codes.mock_file_not_found');

      responseHeaders['X-Mockiji-Not-Found'] = true;
      rawContent = {
        'errorCode': httpCode,
        'errorDescription': 'No mock file was found',
        'evaluatedMockFilePaths': paths.mocks,
      };

      this.Logger.warn({
        'method': request.method,
        'url': url,
        'httpCode': httpCode,
        'evaluatedMockFilePaths': paths.mocks,
      }, `Could not find a mock file for "${request.method} ${url}"`);
    }

    // Set Response Headers
    response.set(responseHeaders);

    // Send Response
    setTimeout(() => {
      if (rawContent !== null && extension === 'html') {
        response.status(httpCode).send(rawContent);
      } else if (rawContent !== null) {
        response.status(httpCode).json(rawContent);
      } else {
        response.set('X-Mockiji-Empty-Response-Body', true);
        response.status(httpCode).send('');
      }

      this.Logger.info({
        'type': 'response',
        'method': method,
        'url': url,
        'httpCode': httpCode,
        'mockPath': fileToLoad,
      }, `Response sent for "${method} ${url}" (${httpCode})`);
    }, delay);
  }
}

module.exports = MockCtrl;
