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

module.exports = {
  RMXModelLoader,
  RMXModel,
  RMXSkeleton,
  RMXModelChunk,
  RMXMaterial,
  RMXBone,
  RMXAnimation,
  RMXAnimationTrack,
RMXPose}
