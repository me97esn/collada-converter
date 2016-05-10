const RMXSkeletalAnimation = require('./rmx/RMXSkeletalAnimation.js')

var ThreejsRenderer = (function () {
  function ThreejsRenderer (params) {
    this.canvas = params.canvas
    this.camera = params.camera
    this.scene = params.scene
    this.renderer = null
    this.mesh = null
    this.lights = []
    this.grid = null
    this.axes = null
    this.stats = null
    this.last_timestamp = null
    this.time = 0
    this.render_loops = 1
    this.animation_index = 0
  }
  ThreejsRenderer.prototype.init = function (scene) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false })
    this.renderer.setSize(canvas.width, canvas.height)
    this.renderer.setClearColor(new THREE.Color(0.5, 0.5, 0.5), 1)
    this.renderer.gammaInput = true
    this.renderer.gammaOutput = true

    this.drawScene()
  }
  /** Zooms the camera so that it shows the object */
  ThreejsRenderer.prototype.zoomToObject = function (scale) {
    this.zoomTo(0, 0, 0, 1 * scale)
  }
  /** Zooms the camera so that it shows the given coordinates */
  ThreejsRenderer.prototype.zoomTo = function (x, y, z, r) {
    this.camera.position.set(x + 1 * r, y + 0.3 * r, z + 0.5 * r)

    this.camera.lookAt(new THREE.Vector3(x, y, z))
    this.camera.updateProjectionMatrix()
  }
  /** Resets the camera */
  ThreejsRenderer.prototype.resetCamera = function () {
    this.zoomToObject(10)
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
