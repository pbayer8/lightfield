
AFRAME.registerComponent('slightfield', {

  init: function () {

    this.slightfield = new Slightfield(this.el.object3D)

    const cameraEl = document.querySelector('[camera]')
    
    cameraEl.addEventListener('loaded', () => {
      const camera = cameraEl.components.camera.camera;
      this.slightfield.setThreeCamera(camera)
      this.slightfield.loadDataSet("field-crystal")

    })
    

  }, tick: function() {
      this.slightfield.render()
  }
})


class Slightfield {
  constructor(object3DToAttachTo) {
    this.object3DToAttachTo = object3DToAttachTo

    this.ipd = .1

    this.xPosLeft = 0
    this.yPosLeft = 0

    this.xPosRight = 0
    this.yPosRight = 0

    this.apertureLeft = 0
    this.apertureRight = 0

    this.aspectRatio = 0

    this.cameraPosLeft = new THREE.Vector3()
    this.cameraPosRight = new THREE.Vector3()
    this.lfPlanePos = new THREE.Vector3()
    this.lfRotation = new THREE.Quaternion()
    this.lfXAxis = new THREE.Vector3(1, 0, 0)
    this.lfYAxis = new THREE.Vector3(0, 1, 0)
    this.lfZAxis = new THREE.Vector3(0, 0, 1)
  }

  loadDataSet(setName) {

    LF.Loader.get(setName)
      .on('progress', (value) => {
        //console.log('loading file: ' + value)
      })
      .on('complete', (file) => {

        this.loadedLightfield = file

        this.canvasLeft = document.createElement('canvas')
        // this.canvasLeft.width = file.frameSize.width
        // this.canvasLeft.height = file.frameSize.height
        this.canvasLeft.width = this.nearestPowerOf2(file.frameSize.width);
        this.canvasLeft.height = this.nearestPowerOf2(file.frameSize.height);
        this.canvasLeft.style.display = 'none'
        this.lfRendererLeft = LF.Renderer.init(this.canvasLeft)

        this.canvasRight = document.createElement('canvas')
        // this.canvasRight.width = file.frameSize.width
        // this.canvasRight.height = file.frameSize.height
        this.canvasRight.width = this.nearestPowerOf2(file.frameSize.width);
        this.canvasRight.height = this.nearestPowerOf2(file.frameSize.height);
        this.canvasRight.style.display = 'none'
        this.lfRendererRight = LF.Renderer.init(this.canvasRight)

        this.aspectRatio = file.frameSize.width / file.frameSize.height

        this.init()

      }).on('error', () => console.log('file load error!'))


  }

  setThreeCamera(camera) {
    this.camera = camera;
  }
  
  init() {

    this.lfTextureLeft = new THREE.Texture(this.canvasLeft)
    this.lfTextureLeft.needsUpdate = true
    this.lfMaterialLeft = new THREE.MeshBasicMaterial({
      map: this.lfTextureLeft
    })
    this.lfPlaneLeft = new THREE.Mesh(new THREE.PlaneGeometry(this.aspectRatio, 1, 1, 1), this.lfMaterialLeft)

    this.lfTextureRight = new THREE.Texture(this.canvasRight)
    this.lfTextureRight.needsUpdate = true
    this.lfMaterialRight = new THREE.MeshBasicMaterial({
      map: this.lfTextureRight
    })
    this.lfPlaneRight = new THREE.Mesh(new THREE.PlaneGeometry(this.aspectRatio, 1, 1, 1), this.lfMaterialRight)

    this.lightField = new THREE.Group()
    this.lightField.add(this.lfPlaneLeft)
    this.lightField.add(this.lfPlaneRight)


    this.object3DToAttachTo.add(this.lightField)

    //make fake eyes... 
    let material = new THREE.MeshBasicMaterial({ color: 0xffff00 })

    this.cameraDotLeft = new THREE.Mesh(new THREE.SphereGeometry(.1, 3, 2), material)
    this.cameraDotRight = new THREE.Mesh(new THREE.SphereGeometry(.1, 3, 2), material)
    this.cameraDotLeft.position.set(-this.ipd, 0, 0)
    this.cameraDotRight.position.set(this.ipd, 0, 0)
    this.cameraDotLeft.visible = false
    this.cameraDotRight.visible = false
    this.camera.add(this.cameraDotLeft)
    this.camera.add(this.cameraDotRight)


    window.addEventListener('vrdisplaypresentchange', function (event) {
      if (event.display.isPresenting) {
        this.lfPlaneLeft.layers.set(1)
        this.lfPlaneRight.layers.set(2)
      } else {
        console.log('Display has stopped presenting.')
      }
    })


    //Calculate render's viewpoint range via lightfield data's matrix size
    this.viewPointXBounds = Math.floor(this.loadedLightfield.matrixSize.width / 2)
    this.viewPointYBounds = Math.floor(this.loadedLightfield.matrixSize.height / 2)
    this.stereoDisparity = 4


    this.meaninglessMult = 3

    this.hasLoaded = true;

  }

  render() {

      if (this.hasLoaded) {

      this.lfRendererLeft.handlePaint()
      this.lfRendererRight.handlePaint()


      // cameraPosLeft.setFromMatrixPosition(camera.matrixWorld)
      this.cameraDotLeft.getWorldPosition(this.cameraPosLeft)
      this.cameraDotRight.getWorldPosition(this.cameraPosRight)
      // lfPlanePos.setFromMatrixPosition(lightField.matrixWorld)            camera.getWorldPosition(cameraPosLeft)
      this.lightField.getWorldPosition(this.lfPlanePos)
      this.cameraPosLeft.sub(this.lfPlanePos)
      this.cameraPosRight.sub(this.lfPlanePos)
      this.lightField.getWorldQuaternion(this.lfRotation)

      //Option 1
      this.lfXAxis.set(1, 0, 0)
      this.lfYAxis.set(0, 1, 0)
      this.lfZAxis.set(0, 0, 1)
      this.lfXAxis.applyQuaternion(this.lfRotation)
      this.lfYAxis.applyQuaternion(this.lfRotation)
      this.lfZAxis.applyQuaternion(this.lfRotation)

      this.cameraPosLeft.normalize()
      this.cameraPosRight.normalize()
      this.dotYLeft = this.cameraPosLeft.dot(this.lfYAxis)
      this.dotXLeft = this.cameraPosLeft.dot(this.lfXAxis)
      this.dotYRight = this.cameraPosRight.dot(this.lfYAxis)
      this.dotXRight = this.cameraPosRight.dot(this.lfXAxis)

      // //temporary fake (stereo) viewing angle calculator using head position
      this.xPosLeft = Math.min(Math.max(this.meaninglessMult * this.dotXLeft * this.loadedLightfield.matrixSize.width, -this.viewPointXBounds), this.viewPointXBounds)
      
      this.xPosRight = Math.min(Math.max(this.meaninglessMult * this.dotXRight * this.loadedLightfield.matrixSize.width, -this.viewPointXBounds), this.viewPointXBounds)

      this.yPosLeft = Math.min(Math.max(this.meaninglessMult * this.dotYLeft * -this.loadedLightfield.matrixSize.height, -this.viewPointYBounds), this.viewPointYBounds)
      
      this.yPosRight = Math.min(Math.max(this.meaninglessMult * this.dotYRight * -this.loadedLightfield.matrixSize.height, -this.viewPointYBounds), this.viewPointYBounds)

      //Each renderer needs a file, aperture, focus, viewpoint
      this.lfRendererLeft.render(this.loadedLightfield, this.apertureLeft, 1, new LF.Vector2(this.xPosLeft, this.yPosLeft))
      this.lfRendererRight.render(this.loadedLightfield, this.apertureRight, 1, new LF.Vector2(this.xPosRight, this.yPosRight))

      this.lfTextureLeft.needsUpdate = true
      this.lfTextureRight.needsUpdate = true

      }
  }

  printVars() {

    console.log('\ncameraPos\n', this.cameraPosLeft,
      '\nlfPlanePos\n', this.lfPlanePos,
      '\nlfRotation\n', this.lfRotation,
      '\nlfAxes\n', this.lfXAxis, this.lfYAxis, this.lfZAxis,
      '\ndotProducts\n', this.dotYLeft, this.dotXLeft,
      '\nx/yPos\n', this.xPosLeft, this.yPosLeft)
  }

  nearestPowerOf2(n) {
    return 1 << 31 - Math.clz32(n)
  }

}

