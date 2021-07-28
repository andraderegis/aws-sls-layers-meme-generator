'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const shell = promisify(exec);
const Joi = require('@hapi/joi');
const axios = require('axios');
const { promises: { writeFile, readFile, unlink } } = require('fs');

const decoratorValidator = require('./utils/decoratorValidator');
const globalEnum = require('./utils/globalEnum');

const POSITION_TEXT_FACTOR = 2.1;

class Handler {
  constructor() { }

  static validator() {
    return Joi.object({
      image: Joi.string().uri().required(),
      topText: Joi.string().max(200).required(),
      bottomText: Joi.string().max(200).optional()
    });
  }

  generateImagePath() {
    return `/tmp/${new Date().getTime()}-out.png`
  }

  async saveImageLocally(imageUrl, imagePath) {
    const { data } = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(data, 'base64');
    return writeFile(imagePath, buffer);
  }

  generateIdentifyCommand(imagePath) {
    const cmdValue = `gm identify \
    -verbose \
    ${imagePath}`;

    return cmdValue.split('\n').join('');
  }

  async getImageSize(imagePath) {
    const command = this.generateIdentifyCommand(imagePath);
    const { stdout } = await shell(command);

    const [line] = stdout.trim().split('\n').filter(text => ~text.indexOf('Geometry'));
    const [width, height] = line.trim().replace('Geometry:', "").split('x');

    return {
      height: Number(height),
      width: Number(width)
    }
  }

  getParameters(options, dimensions, imagePath) {
    return {
      topText: options.topText,
      bottomText: options.bottomText || "",
      font: __dirname + './resources/impact.ttf',
      fontSize: dimensions.width / 12,
      fontFill: '#FFF',
      textPos: 'center',
      strokeColor: '#000',
      strokeWeight: 1,
      padding: 40,
      imagePath
    }
  }

  getTextPosition(dimensions, padding) {
    const top = Math.abs((dimensions.height / POSITION_TEXT_FACTOR) - padding) * -1;
    const bottom = (dimensions.height / POSITION_TEXT_FACTOR) - padding;

    return {
      top,
      bottom
    }
  }

  generateConvertCommand(options, finalPath) {
    const command = `
      gm convert
      '${options.imagePath}'
      -font '${options.font}'
      -pointsize ${options.fontSize}
      -fill '${options.fontFill}'
      -stroke '${options.strokeColor}'
      -strokewidth ${options.strokeWeight}
      -draw 'gravity ${options.textPos} text 0,${options.top} "${options.topText}"'
      -draw 'gravity ${options.textPos} text 0,${options.bottom} "${options.bottomText}"'
      ${finalPath}
    `

    return command.split('\n').join('');
  }

  async generateMemeImage(options, processedImagePath) {
    const command = this.generateConvertCommand(options, processedImagePath);

    const { stdout } = await shell(command);

    return stdout;
  }

  async generateBase64(imagePath) {
    return readFile(imagePath, 'base64');
  }

  async removeImages(originalImagePath, processedImagePath) {
    return Promise.all([
      unlink(originalImagePath),
      unlink(processedImagePath)
    ]);
  }

  async main(event) {
    try {
      console.log('Downloading image...');

      const options = event[globalEnum.ARG_TYPE.QUERY_STRING];
      const imagePath = this.generateImagePath();

      await this.saveImageLocally(options.image, imagePath);

      console.log('Getting image size...');
      const dimensions = await this.getImageSize(imagePath);
      const params = this.getParameters(options, dimensions, imagePath);
      const { top, bottom } = this.getTextPosition(dimensions, params.padding);
      const processedImagePath = this.generateImagePath();

      console.log('Generating meme image...');

      await this.generateMemeImage({
        ...params,
        top,
        bottom
      }, processedImagePath);

      console.log('generating base64...');
      const imageBuffer = await this.generateBase64(processedImagePath);

      console.log('finishing...');
      await this.removeImages(imagePath, processedImagePath);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html'
        },
        body: `<img src="data:image/jpeg;base64,${imageBuffer}"/>`
      }
    } catch (e) {
      console.error('error****', e.stack);
      return {
        statusCode: 500,
        body: process.env.IS_LOCAL
          ? e.stack
          : 'Internal server error'
      }
    }
  }
}

const handler = new Handler();

// module.exports = {
//   mememaker: handler.main.bind(handler)
// };

module.exports = {
  mememaker: decoratorValidator(
    handler.main.bind(handler),
    Handler.validator(),
    globalEnum.ARG_TYPE.QUERY_STRING
  )
};