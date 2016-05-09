var RMXSkeletalAnimation = (function () {
  function RMXSkeletalAnimation () {
  }
  /**
  * Exports all bone matrices (world matrix * inverse bind matrix) of a pose to a flat number array
  */
  RMXSkeletalAnimation.exportPose = function (skeleton, pose, dest) {
    var world_matrices = pose.world_matrices
    // Loop over all bones
    var bone_length = skeleton.bones.length
    for (var b = 0; b < bone_length; ++b) {
      var bone = skeleton.bones[b]
      var inv_bind_mat = bone.inv_bind_mat
      // Local matrix - local translation/rotation/scale composed into a matrix
      mat_stream_compose(world_matrices, b * 16, pose.pos, b * 3, pose.rot, b * 4, pose.scl, b * 3)
      // World matrix
      if (bone.parent >= 0) {
        mat4_stream_multiply(world_matrices, b * 16, world_matrices, bone.parent * 16, world_matrices, b * 16)
      }
      // Bone matrix
      mat4_stream_multiply(dest, b * 16, world_matrices, b * 16, inv_bind_mat, 0)
    }
  }
  /**
  * Reset the pose to the bind pose of the skeleton
  */
  RMXSkeletalAnimation.resetPose = function (skeleton, pose) {
    var dest_pos = pose.pos
    var dest_rot = pose.rot
    var dest_scl = pose.scl
    // Loop over all bones
    var bone_length = skeleton.bones.length
    for (var b = 0; b < bone_length; ++b) {
      var b3 = b * 3
      var b4 = b * 4
      // Bone data
      var bone = skeleton.bones[b]
      var bone_pos = bone.pos
      var bone_rot = bone.rot
      var bone_scl = bone.scl
      vec3_stream_copy(dest_pos, b3, bone_pos, 0)
      quat_stream_copy(dest_rot, b4, bone_rot, 0)
      vec3_stream_copy(dest_scl, b3, bone_scl, 0)
    }
  }
  /**
  * Computes an interpolation of the two poses pose_a and pose_b
  * At t==0, full weight is given to pose_a, at t==1, full weight is given to pose_b
  */
  RMXSkeletalAnimation.blendPose = function (pose_a, pose_b, t, result) {
    var a_pos = pose_a.pos
    var a_rot = pose_a.rot
    var a_scl = pose_a.scl
    var b_pos = pose_b.pos
    var b_rot = pose_b.rot
    var b_scl = pose_b.scl
    var r_pos = result.pos
    var r_rot = result.rot
    var r_scl = result.scl
    // Loop over all bones
    var bone_length = a_pos.length / 3
    for (var b = 0; b < bone_length; ++b) {
      var b3 = b * 3
      var b4 = b * 4
      vec3_stream_lerp(r_pos, b3, a_pos, b3, b_pos, b3, t)
      quat_stream_slerp(r_rot, b4, a_rot, b4, b_rot, b4, t)
      vec3_stream_lerp(r_scl, b3, a_scl, b3, b_scl, b3, t)
    }
  }
  /**
  * Sample the animation, store the result in pose
  */
  RMXSkeletalAnimation.sampleAnimation = function (animation, skeleton, pose, frame) {
    var looped = true
    if (looped) {
      frame = frame % animation.frames
    } else {
      frame = Math.max(Math.min(frame, animation.frames - 1), 0)
    }
    var f1 = Math.floor(frame)
    f1 = f1 % animation.frames
    var f2 = Math.ceil(frame)
    f2 = f2 % animation.frames
    var f13 = f1 * 3
    var f14 = f1 * 4
    var f23 = f2 * 3
    var f24 = f2 * 4
    var s = frame - Math.floor(frame)
    var bones = skeleton.bones
    var tracks = animation.tracks
    var dest_pos = pose.pos
    var dest_rot = pose.rot
    var dest_scl = pose.scl
    // Loop over all bones
    var bone_length = bones.length
    for (var b = 0; b < bone_length; ++b) {
      var b3 = b * 3
      var b4 = b * 4
      // Animation track data
      var track = tracks[b]
      var track_pos = track.pos
      var track_rot = track.rot
      var track_scl = track.scl
      // Bone data
      var bone = bones[b]
      var bone_pos = bone.pos
      var bone_rot = bone.rot
      var bone_scl = bone.scl
      // Position (linear interpolation)
      if (track_pos) {
        vec3_stream_lerp(dest_pos, b3, track_pos, f13, track_pos, f23, s)
      } else {
        vec3_stream_copy(dest_pos, b3, bone_pos, 0)
      }
      // Rotation (quaternion spherical interpolation)
      if (track_rot) {
        quat_stream_slerp(dest_rot, b4, track_rot, f14, track_rot, f24, s)
      } else {
        quat_stream_copy(dest_rot, b4, bone_rot, 0)
      }
      // Scale (linear interpolation)
      if (track_scl) {
        vec3_stream_lerp(dest_scl, b3, track_scl, f13, track_scl, f23, s)
      } else {
        vec3_stream_copy(dest_scl, b3, bone_scl, 0)
      }
    }
  }
  return RMXSkeletalAnimation
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
function vec3_stream_copy (out, out_offset, a, a_offset) {
  out[out_offset + 0] = a[a_offset + 0]
  out[out_offset + 1] = a[a_offset + 1]
  out[out_offset + 2] = a[a_offset + 2]
}
function quat_stream_copy (out, out_offset, a, a_offset) {
  out[out_offset + 0] = a[a_offset + 0]
  out[out_offset + 1] = a[a_offset + 1]
  out[out_offset + 2] = a[a_offset + 2]
  out[out_offset + 3] = a[a_offset + 3]
}
function vec3_stream_lerp (out, out_offset, a, a_offset, b, b_offset, t) {
  var ta = 1 - t
  out[out_offset + 0] = ta * a[a_offset + 0] + t * a[b_offset + 0]
  out[out_offset + 1] = ta * a[a_offset + 1] + t * a[b_offset + 1]
  out[out_offset + 2] = ta * a[a_offset + 2] + t * a[b_offset + 2]
}
function quat_stream_slerp (out, out_offset, a, a_offset, b, b_offset, t) {
  var ax = a[a_offset + 0], ay = a[a_offset + 1], az = a[a_offset + 2], aw = a[a_offset + 3], bx = b[b_offset + 0], by = b[b_offset + 1], bz = b[b_offset + 2], bw = b[b_offset + 3]
  var omega, cosom, sinom, scale0, scale1
  // calc cosine
  cosom = ax * bx + ay * by + az * bz + aw * bw
  // adjust signs (if necessary)
  if (cosom < 0.0) {
    cosom = -cosom
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }
  // calculate coefficients
  if ((1.0 - cosom) > 0.000001) {
    // standard case (slerp)
    omega = Math.acos(cosom)
    sinom = Math.sin(omega)
    scale0 = Math.sin((1.0 - t) * omega) / sinom
    scale1 = Math.sin(t * omega) / sinom
  } else {
    // "from" and "to" quaternions are very close 
    //  ... so we can do a linear interpolation
    scale0 = 1.0 - t
    scale1 = t
  }
  // calculate final values
  out[out_offset + 0] = scale0 * ax + scale1 * bx
  out[out_offset + 1] = scale0 * ay + scale1 * by
  out[out_offset + 2] = scale0 * az + scale1 * bz
  out[out_offset + 3] = scale0 * aw + scale1 * bw
}
function mat_stream_compose (out, out_offset, pos, pos_offset, rot, rot_offset, scl, scl_offset) {
  // Quaternion math
  var x = rot[rot_offset + 0], y = rot[rot_offset + 1], z = rot[rot_offset + 2], w = rot[rot_offset + 3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2, sx = scl[scl_offset + 0], sy = scl[scl_offset + 1], sz = scl[scl_offset + 2]
  out[out_offset + 0] = sx * (1 - (yy + zz))
  out[out_offset + 1] = sy * (xy + wz)
  out[out_offset + 2] = sz * (xz - wy)
  out[out_offset + 3] = 0
  out[out_offset + 4] = sx * (xy - wz)
  out[out_offset + 5] = sy * (1 - (xx + zz))
  out[out_offset + 6] = sz * (yz + wx)
  out[out_offset + 7] = 0
  out[out_offset + 8] = sx * (xz + wy)
  out[out_offset + 9] = sy * (yz - wx)
  out[out_offset + 10] = sz * (1 - (xx + yy))
  out[out_offset + 11] = 0
  out[out_offset + 12] = pos[pos_offset + 0]
  out[out_offset + 13] = pos[pos_offset + 1]
  out[out_offset + 14] = pos[pos_offset + 2]
  out[out_offset + 15] = 1
}

function mat4_stream_multiply (out, out_offset, a, a_offset, b, b_offset) {
  var a00 = a[a_offset + 0], a01 = a[a_offset + 1], a02 = a[a_offset + 2], a03 = a[a_offset + 3], a10 = a[a_offset + 4], a11 = a[a_offset + 5], a12 = a[a_offset + 6], a13 = a[a_offset + 7], a20 = a[a_offset + 8], a21 = a[a_offset + 9], a22 = a[a_offset + 10], a23 = a[a_offset + 11], a30 = a[a_offset + 12], a31 = a[a_offset + 13], a32 = a[a_offset + 14], a33 = a[a_offset + 15]
  // Cache only the current line of the second matrix
  var b0 = b[b_offset + 0], b1 = b[b_offset + 1], b2 = b[b_offset + 2], b3 = b[b_offset + 3]
  out[out_offset + 0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  out[out_offset + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  out[out_offset + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  out[out_offset + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  b0 = b[b_offset + 4]
  b1 = b[b_offset + 5]
  b2 = b[b_offset + 6]
  b3 = b[b_offset + 7]
  out[out_offset + 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  out[out_offset + 5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  out[out_offset + 6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  out[out_offset + 7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  b0 = b[b_offset + 8]
  b1 = b[b_offset + 9]
  b2 = b[b_offset + 10]
  b3 = b[b_offset + 11]
  out[out_offset + 8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  out[out_offset + 9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  out[out_offset + 10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  out[out_offset + 11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  b0 = b[b_offset + 12]
  b1 = b[b_offset + 13]
  b2 = b[b_offset + 14]
  b3 = b[b_offset + 15]
  out[out_offset + 12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  out[out_offset + 13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  out[out_offset + 14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  out[out_offset + 15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
}

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
        var loader = new RMXModelLoader
        var model = loader.loadModel(json, data.buffer)
        var loader2 = new ThreejsModelLoader
        var model2 = loader2.createModel(model)
        var mesh = model2.instanciate()

        return mesh
      })
  }
}
