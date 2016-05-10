const RMXSkeletalAnimation = require('./rmx/RMXSkeletalAnimation.js')

var ThreejsRenderer = (function () {
  function ThreejsRenderer (params) {
    this.canvas = params.canvas
    this.camera = params.camera
    this.scene = params.scene
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
    this.drawScene()
    return true
  }
  /** Draws the scene */
  ThreejsRenderer.prototype.drawScene = function () {
    this.renderer.render(this.scene, this.camera)
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
  ThreejsRenderer.prototype.setChunk = function (index) {
    var mesh = this.mesh
    mesh.children.forEach(function (child, i) {
      child.visible = index === -1 || index === i
    })
  }
  ThreejsRenderer.prototype.setMesh = function (json, data) {
    this.resetMesh()
    if (!json || !data) {
      return
    }
    var loader = new RMXModelLoader
    var model = loader.loadModel(json, data.buffer)
    var loader2 = new ThreejsModelLoader
    var model2 = loader2.createModel(model)
    this.mesh = model2.instanciate()
    this.scene.add(this.mesh)
    this.zoomToObject(5)
  }
  ThreejsRenderer.prototype.resetMesh = function () {
    if (this.mesh) {
      this.scene.remove(this.mesh)
      this.mesh = null
    }
  }
  return ThreejsRenderer
})()

module.exports = ThreejsRenderer
