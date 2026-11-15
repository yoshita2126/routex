const User = require('../models/User');

// @desc    Save a route for the logged-in user
// @route   POST /api/routes
// @access  Private
exports.saveRoute = async (req, res) => {
  try {
    const { origin, destination, distance, duration, mode } = req.body;

    if (!origin || !destination || distance === undefined || duration === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Origin, destination, distance, and duration are required.',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const newRoute = {
      origin,
      destination,
      distance,
      duration,
      mode: mode || 'driving',
      createdAt: new Date(),
    };

    user.savedRoutes.unshift(newRoute);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Route saved successfully to your account.',
      savedRoute: user.savedRoutes[0],
    });
  } catch (error) {
    console.error('Save route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save route.',
    });
  }
};

// @desc    Get all saved routes for the logged-in user
// @route   GET /api/routes
// @access  Private
exports.getSavedRoutes = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      routes: user.savedRoutes,
    });
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve saved routes.',
    });
  }
};

// @desc    Delete a saved route
// @route   DELETE /api/routes/:id
// @access  Private
exports.deleteSavedRoute = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.savedRoutes = user.savedRoutes.filter(
      (r) => r._id.toString() !== req.params.id
    );
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Route removed from saved routes.',
    });
  } catch (error) {
    console.error('Delete route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete route.',
    });
  }
};

