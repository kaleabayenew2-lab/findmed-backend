const express = require('express');
const router = express.Router();
const controller = require('../controllers/facilitiesController');
const multer = require('multer');
const upload = multer({ dest: '/tmp' });

router.get('/', controller.list);
router.get('/catalog', controller.catalog);
router.get('/check-name', controller.checkName);
router.post('/:id/reset-password', controller.resetPassword);
// endpoints for facility images
router.post('/:id/photo', upload.single('file'), controller.uploadPhoto);
router.post('/:id/photos', upload.single('file'), controller.addPhoto);

router.post('/', controller.create);
router.post('/login', controller.login);
router.get('/:id', controller.get);
router.put('/:id', controller.update);
// record a view for analytics
router.post('/:id/view', controller.recordView);
// submit a rating for facility
router.post('/:id/rate', controller.rate);

module.exports = router;
