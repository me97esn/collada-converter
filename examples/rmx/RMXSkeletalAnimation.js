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

module.exports = RMXSkeletalAnimation
