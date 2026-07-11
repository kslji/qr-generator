const express = require('express');
const controller = require('../controllers/documentController');

const router = express.Router();

router.get('/:id', controller.resolveScan);

module.exports = router;
