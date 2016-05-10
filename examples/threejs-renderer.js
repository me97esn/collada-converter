const RMXSkeletalAnimation = require('./rmx/RMXSkeletalAnimation.js')

var ThreejsRenderer = (function () {
  function ThreejsRenderer (params) {
    this.renderer = params.renderer
    this.time = 0
    this.render_loops = 1
    this.animation_index = 0
  }

  /** Main render loop */
  ThreejsRenderer.prototype.tick = function (timestamp) {
    // Abort if there is nothing to render
    if (!this.mesh) {
      return false
    }
    // Timing
    var delta_time = 0
    if (timestamp === null) {
      this.last_timestamp = null
      this.time = 0
    }
    else if (this.last_timestamp === null) {
      this.last_timestamp = timestamp
      this.time = 0
    } else {
      delta_time = timestamp - this.last_timestamp
      this.last_timestamp = timestamp
    }
    this.updateAnimation(delta_time)

    return true
  }

  /** Updates skeletal animation data */
  ThreejsRenderer.prototype.updateAnimation = function (delta_time) {
    this.time += delta_time / (1000)
    var mesh = this.mesh
    var data = mesh.userData
    if (data.skeleton) {
      if (data.model.animations.length > 0) {
        var index = this.animation_index
        if (index < 0)
          index = 0
        if (index >= data.model.animations.length)
          index = data.model.animations.length
        RMXSkeletalAnimation.sampleAnimation(data.model.animations[index], data.model.skeleton, data.skeleton.pose, this.time * 25)
      } else {
        RMXSkeletalAnimation.resetPose(data.model.skeleton, data.skeleton.pose)
      }
      var gl = this.renderer.context
      data.skeleton.update(gl)
    }
  }
  ThreejsRenderer.prototype.setAnimation = function (index) {
    this.animation_index = index
    this.time = 0
  }

  return ThreejsRenderer
})()

module.exports = ThreejsRenderer
