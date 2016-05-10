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

module.exports = RMXBoneMatrixTexture
