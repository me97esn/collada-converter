const RMXSkeletalAnimation = require('./rmx/RMXSkeletalAnimation.js')
const {RMXModelLoader, RMXModel, RMXSkeleton, RMXModelChunk, RMXMaterial, RMXBone, RMXAnimation, RMXAnimationTrack, RMXPose} = require('./rmx/RMXModelLoader.js')
const ThreejsRenderer = require('./threejs-renderer.js')
const RMXBoneMatrixTexture = require('./rmx/RMXBoneMatrixTexture.js')
/**
* A collection of static functions to play back skeletal animations.
*/

/**
* Converts a RMXModel into corresponding three.js objects
*/
var ThreejsModelLoader = (function () {
  function ThreejsModelLoader () {
    this.materialCache = {}
    this.imageLoader = new THREE.ImageLoader()
  }
  ThreejsModelLoader.prototype.createGeometry = function (chunk) {
    var result = new THREE.BufferGeometry
    if (chunk.data_position) {
      result.addAttribute('position', new THREE.BufferAttribute(chunk.data_position, 3))
    }
    if (chunk.data_normal) {
      result.addAttribute('normal', new THREE.BufferAttribute(chunk.data_normal, 3))
    }
    if (chunk.data_texcoord) {
      result.addAttribute('uv', new THREE.BufferAttribute(chunk.data_texcoord, 2))
    }
    if (chunk.data_boneindex) {
      result.addAttribute('skinIndex', new THREE.BufferAttribute(chunk.data_boneindex, 4))
    }
    if (chunk.data_boneindex) {
      result.addAttribute('skinWeight', new THREE.BufferAttribute(chunk.data_boneweight, 4))
    }
    if (chunk.data_indices) {
      result.addAttribute('index', new THREE.BufferAttribute(chunk.data_indices, 1))
    }
    return result
  }
  ThreejsModelLoader.prototype.createTexture = function (url) {
    if (url == null || url == '') {
      return null
    }
    var image = this.imageLoader.load(url)
    var result = new THREE.Texture(image)
    return result
  }
  ThreejsModelLoader.prototype.createMaterial = function (material, skinned) {
    var prefix = skinned ? 'skinned-' : 'static-'
    var hash = prefix + material.hash()
    var cached_material = this.materialCache[hash]
    if (cached_material) {
      return cached_material
    } else {
      var result = new THREE.MeshPhongMaterial()
      result.skinning = skinned
      result.color = new THREE.Color(0.8, 0.8, 0.8)
      // Disable textures. They won't work due to CORS for local files anyway.
      result.map = null; // this.createTexture(material.diffuse)
      result.specularMap = null; // this.createTexture(material.specular)
      result.normalMap = null; // this.createTexture(material.normal)
      this.materialCache[hash] = result
      return result
    }
  }
  ThreejsModelLoader.prototype.createModel = function (model) {
    var result = new ThreejsModel
    var skinned = model.skeleton != null
    for (var i = 0; i < model.chunks.length; ++i) {
      var rmx_chunk = model.chunks[i]
      var threejs_chunk = new ThreejsModelChunk
      threejs_chunk.geometry = this.createGeometry(rmx_chunk)
      threejs_chunk.material = this.createMaterial(model.materials[rmx_chunk.material_index], skinned)
      result.chunks.push(threejs_chunk)
    }
    // Skeleton - use custom object
    result.skeleton = model.skeleton
    // Animation - use custom object
    result.animations = model.animations
    return result
  }
  return ThreejsModelLoader
})()
/**
* A custom class that replaces THREE.Skeleton
*/
var ThreejsSkeleton = (function () {
  function ThreejsSkeleton (skeleton) {
    // The skeleton stores information about the hiearchy of the bones
    this.skeleton = skeleton
    // The pose stores information about the current bone transformations
    this.pose = new RMXPose(skeleton.bones.length)
    RMXSkeletalAnimation.resetPose(this.skeleton, this.pose)
    // The bone texture stores the bone matrices for the use on the GPU
    this.boneTexture = new RMXBoneMatrixTexture(skeleton.bones.length)
    // Trick three.js into thinking this is a THREE.Skeleton object
    Object.defineProperty(this, 'useVertexTexture', { get: function () {
        return true
    } })
    Object.defineProperty(this, 'boneTextureWidth', { get: function () {
        return this.boneTexture.size
    } })
    Object.defineProperty(this, 'boneTextureHeight', { get: function () {
        return this.boneTexture.size
    } })
    // Trick three.js into thinking our bone texture is a THREE.DataTexture
    Object.defineProperty(this.boneTexture, '__webglTexture', { get: function () {
        return this.texture
    } })
    Object.defineProperty(this.boneTexture, 'needsUpdate', { get: function () {
        return false
    } })
    Object.defineProperty(this.boneTexture, 'width', { get: function () {
        return this.size
    } })
    Object.defineProperty(this.boneTexture, 'height', { get: function () {
        return this.size
    } })
  }
  ThreejsSkeleton.prototype.update = function (gl) {
    // Compute the bone matrices
    RMXSkeletalAnimation.exportPose(this.skeleton, this.pose, this.boneTexture.data)
    // Upload the bone matrices to the bone texture
    this.boneTexture.update(gl)
  }
  return ThreejsSkeleton
})()
/**
* Stores information about a piece of geometry
*/
var ThreejsModelChunk = (function () {
  function ThreejsModelChunk () {
    this.geometry = null
    this.material = null
  }
  return ThreejsModelChunk
})()
var ThreejsModelInstance = (function () {
  function ThreejsModelInstance (model, skeleton) {
    this.model = model
    this.skeleton = skeleton
  }
  return ThreejsModelInstance
})()
/**
* A factory for producing objects that behave like THREE.SkinnedMesh
*/
var ThreejsModel = (function () {
  function ThreejsModel () {
    this.chunks = []
    this.skeleton = null
    this.animations = []
  }
  ThreejsModel.prototype.instanciate = function () {
    // Create one container object.
    var result = new THREE.Object3D
    // Create one custom skeleton object.
    var threejsSkeleton = null
    if (this.skeleton) {
      threejsSkeleton = new ThreejsSkeleton(this.skeleton)
    }
    for (var i = 0; i < this.chunks.length; ++i) {
      var chunk = this.chunks[i]
      var mesh = new THREE.Mesh(chunk.geometry, chunk.material)
      // Trick three.js into thinking this is a THREE.SkinnedMesh.
      if (this.skeleton) {
        mesh.userData = threejsSkeleton
        Object.defineProperty(mesh, 'skeleton', { get: function () {
            return this.userData
        } })
        Object.defineProperty(mesh, 'bindMatrix', { get: function () {
            return ThreejsModel.identityMatrix
        } })
        Object.defineProperty(mesh, 'bindMatrixInverse', { get: function () {
            return ThreejsModel.identityMatrix
        } })
      }
      // Add the mesh to the container object.
      result.add(mesh)
    }
    // Store the custom skeleton in the container object.
    result.userData = new ThreejsModelInstance(this, threejsSkeleton)
    return result
  }
  return ThreejsModel
})()
ThreejsModel.identityMatrix = new THREE.Matrix4()
ThreejsModel.identityMatrix.identity()

// ----------------------------------------------------------------------------
// Evil global data
// ----------------------------------------------------------------------------
var timestamps = {}
var renderer

// ----------------------------------------------------------------------------
// Renderer
// ----------------------------------------------------------------------------
function renderSetModel (json, data) {
  renderer.setMesh(json, data)
}

function convertRenderPreview () {
  var json
  window.fetch('model.json')
    .then(response => response.json())
    .then(function (_json) { return json = _json; })
    .then(() => window['fetch']('model.bin'))
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => {
      var data = new Uint8Array(arrayBuffer)
      var loader = new RMXModelLoader
      var model = loader.loadModel(json, data.buffer)
      var loader2 = new ThreejsModelLoader
      var model2 = loader2.createModel(model)
      var mesh = model2.instanciate()
      // ////////
      renderer.mesh = mesh
      renderer.scene.add(mesh)
      // /////////
      renderStartRendering()
    }).catch(e => console.error(e))
}

// Initialize WebGL

module.exports = {
  renderer,
  ThreejsRenderer,
  loadModel(path = '') {
    var json
    return window.fetch(`${path}/model.json`)
      .then(response => response.json())
      .then(function (_json) { return json = _json; })
      .then(() => window.fetch('model.bin'))
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => {
        var data = new Uint8Array(arrayBuffer)
        var loader = new RMXModelLoader()
        var model = loader.loadModel(json, data.buffer)
        var loader2 = new ThreejsModelLoader()
        var model2 = loader2.createModel(model)
        var mesh = model2.instanciate()

        return mesh
      })
  }
}
