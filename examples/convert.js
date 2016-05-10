const RMXSkeletalAnimation = require('./rmx/RMXSkeletalAnimation.js')

/**
* A skinned mesh with an animation
*/
var RMXModel = (function () {
  function RMXModel () {
    this.chunks = []
    this.skeleton = new RMXSkeleton()
    this.materials = []
    this.animations = []
  }
  return RMXModel
})()

var ThreejsRenderer = (function () {
  function ThreejsRenderer (params) {
    this.canvas = null
    this.camera = null
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
  ThreejsRenderer.prototype.init = function (scene, renderer) {
    var _this = this
    this.canvas = canvas
    // Camera
    this.camera = new THREE.PerspectiveCamera(27, canvas.width / canvas.height, 1, 10)
    this.resetCamera()

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
    this.camera.up.set(0, 0, 1)
    this.camera.lookAt(new THREE.Vector3(x, y, z))
    this.camera.far = 2 * r + 20
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

/**
* One piece of geometry with one material
*/
var RMXModelChunk = (function () {
  function RMXModelChunk () {
    this.name = ''
    this.triangle_count = 0
    this.vertex_count = 0
    this.index_offset = 0
    this.data_position = null
    this.data_normal = null
    this.data_texcoord = null
    this.data_boneweight = null
    this.data_boneindex = null
    this.data_indices = null
    this.material_index = 0
  }
  return RMXModelChunk
})()
/**
* A material.
* Does not contain coefficients, use textures instead.
*/
var RMXMaterial = (function () {
  function RMXMaterial () {
    this.diffuse = null
    this.specular = null
    this.normal = null
  }
  RMXMaterial.prototype.hash = function () {
    return 'material|' + (this.diffuse || '') + '|' + (this.specular || '') + '|' + (this.normal || '')
  }
  return RMXMaterial
})()
/**
* A skinned mesh skeleton
*/
var RMXSkeleton = (function () {
  function RMXSkeleton () {
    this.bones = []
  }
  return RMXSkeleton
})()
/**
* A skeleton bone.
*/
var RMXBone = (function () {
  function RMXBone () {
  }
  return RMXBone
})()
/**
* A skinned mesh animation
*/
var RMXAnimation = (function () {
  function RMXAnimation () {
    this.name = ''
    this.frames = 0
    this.fps = 0
    this.tracks = []
  }
  return RMXAnimation
})()
/**
* An animation track.
* Contains animation curves for the transformation of a single bone.
*/
var RMXAnimationTrack = (function () {
  function RMXAnimationTrack () {
    this.bone = 0
    this.pos = null
    this.rot = null
    this.scl = null
  }
  return RMXAnimationTrack
})()

/**
* Loads our custom file format
*/
var RMXModelLoader = (function () {
  function RMXModelLoader () {
  }
  RMXModelLoader.prototype.loadFloatData = function (json, data) {
    if (json) {
      return new Float32Array(data, json.byte_offset, json.count * json.stride)
    } else {
      return null
    }
  }
  RMXModelLoader.prototype.loadUint8Data = function (json, data) {
    if (json) {
      return new Uint8Array(data, json.byte_offset, json.count * json.stride)
    } else {
      return null
    }
  }
  RMXModelLoader.prototype.loadUint32Data = function (json, data) {
    if (json) {
      return new Uint32Array(data, json.byte_offset, json.count * json.stride)
    } else {
      return null
    }
  }
  RMXModelLoader.prototype.loadModelChunk = function (json, data) {
    var result = new RMXModelChunk
    result.name = json.name
    result.triangle_count = json.triangle_count
    result.material_index = json.material
    result.data_position = this.loadFloatData(json.position, data)
    result.data_normal = this.loadFloatData(json.normal, data)
    result.data_texcoord = this.loadFloatData(json.texcoord, data)
    result.data_boneweight = this.loadFloatData(json.boneweight, data)
    result.data_boneindex = this.loadUint8Data(json.boneindex, data)
    result.data_indices = this.loadUint32Data(json.indices, data)
    // Three.js wants float data
    if (result.data_boneindex) {
      result.data_boneindex = new Float32Array(result.data_boneindex)
    }
    return result
  }
  RMXModelLoader.prototype.loadModel = function (json, data) {
    var _this = this
    var result = new RMXModel
    // Load geometry
    result.chunks = json.chunks.map(function (chunk) {
      return _this.loadModelChunk(chunk, data)
    })
    // Load skeleton
    result.skeleton = this.loadSkeleton(json, data)
    // Load animations
    result.animations = json.animations.map(function (animation) {
      return _this.loadAnimation(animation, data)
    })
    // Load materials
    result.materials = json.materials.map(function (material) {
      return _this.loadMaterial(material, data)
    })
    return result
  }
  RMXModelLoader.prototype.loadBone = function (json, data) {
    if (json == null) {
      return null
    }
    var result = new RMXBone
    result.name = json.name
    result.parent = json.parent
    result.skinned = json.skinned
    result.inv_bind_mat = new Float32Array(json.inv_bind_mat)
    result.pos = vec3.clone(json.pos)
    result.rot = quat.clone(json.rot)
    result.scl = vec3.clone(json.scl)
    return result
  }
  RMXModelLoader.prototype.loadSkeleton = function (json, data) {
    var _this = this
    if (json.bones == null || json.bones.length == 0) {
      return null
    }
    var result = new RMXSkeleton
    result.bones = json.bones.map(function (bone) {
      return _this.loadBone(bone, data)
    })
    return result
  }
  RMXModelLoader.prototype.loadAnimationTrack = function (json, data) {
    if (json == null) {
      return null
    }
    var result = new RMXAnimationTrack
    result.bone = json.bone
    result.pos = this.loadFloatData(json.pos, data)
    result.rot = this.loadFloatData(json.rot, data)
    result.scl = this.loadFloatData(json.scl, data)
    return result
  }
  RMXModelLoader.prototype.loadAnimation = function (json, data) {
    var _this = this
    if (json == null) {
      return null
    }
    var result = new RMXAnimation
    result.name = json.name
    result.fps = json.fps
    result.frames = json.frames
    result.tracks = json.tracks.map(function (track) {
      return _this.loadAnimationTrack(track, data)
    })
    return result
  }
  RMXModelLoader.prototype.loadMaterial = function (json, data) {
    var result = new RMXMaterial
    result.diffuse = json.diffuse
    result.specular = json.specular
    result.normal = json.normal
    return result
  }
  return RMXModelLoader
})()

// / <reference path="./stream-math.ts" />
/**
* Stores the transformation of all skeleton bones.
*/
var RMXPose = (function () {
  function RMXPose (bones) {
    this.pos = new Float32Array(bones * 3)
    this.rot = new Float32Array(bones * 4)
    this.scl = new Float32Array(bones * 3)
    this.world_matrices = new Float32Array(bones * 16)
  }
  return RMXPose
})()
/**
* Stores the bone matrices in a WebGL texture.
*/
var RMXBoneMatrixTexture = (function () {
  function RMXBoneMatrixTexture (bones) {
    this.size = RMXBoneMatrixTexture.optimalSize(bones)
    this.data = new Float32Array(4 * this.size * this.size)
    this.texture = null
  }
  /**
  * Number of bones a texture of the given width can store.
  */
  RMXBoneMatrixTexture.capacity = function (size) {
    var texels = size * size
    var texels_per_matrix = 4
    return texels / texels_per_matrix
  }
  /**
  * The smallest texture size that can hold the given number of bones.
  */
  RMXBoneMatrixTexture.optimalSize = function (bones) {
    var result = 4
    while (RMXBoneMatrixTexture.capacity(result) < bones) {
      result = result * 2
      // A 2K x 2K texture can hold 1 million bones.
      // It is unlikely a skinned mesh will use more than that.
      if (result > 2048)
        throw new Error('Too many bones')
    }
    return result
  }
  RMXBoneMatrixTexture.prototype.init = function (gl) {
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.size, this.size, 0, gl.RGBA, gl.FLOAT, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }
  RMXBoneMatrixTexture.prototype.update = function (gl) {
    if (this.texture == null) {
      this.init(gl)
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    // Apparently texImage can be faster than texSubImage (?!?)
    // gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.size, this.size, gl.RGBA, gl.FLOAT, this.data)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.size, this.size, 0, gl.RGBA, gl.FLOAT, this.data)
  }
  return RMXBoneMatrixTexture
})()
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
