const {RMXModelLoader, RMXModel, RMXSkeleton, RMXModelChunk, RMXMaterial, RMXBone, RMXAnimation, RMXAnimationTrack, RMXPose} = require('./rmx/RMXModelLoader.js')
const RMXSkeletalAnimation = require('./rmx/RMXSkeletalAnimation.js')
const RMXBoneMatrixTexture = require('./rmx/RMXBoneMatrixTexture.js')

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

module.exports = {
  ThreejsModelChunk,
  ThreejsModelInstance,
ThreejsModel}
