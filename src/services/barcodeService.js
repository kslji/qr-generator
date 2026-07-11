const bwipjs = require('bwip-js');

/**
 * Renders a PNG buffer of a CODE128 barcode encoding the document's short ID.
 * CODE128 is used because it handles the full alphanumeric ID cleanly and is
 * readable by essentially every commercial barcode scanner.
 */
async function generateBarcodePng(id) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: id,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: 'center'
  });
}

module.exports = { generateBarcodePng };
