const express = require('express');
const router = express.Router();
const {
  saveRoute,
  getSavedRoutes,
  deleteSavedRoute,
} = require('../controllers/routeController');
const { protect } = require('../middleware/auth');

router.use(protect); // All route actions require authentication

router.route('/')
  .post(saveRoute)
  .get(getSavedRoutes);

router.route('/:id')
  .delete(deleteSavedRoute);

module.exports = router;

