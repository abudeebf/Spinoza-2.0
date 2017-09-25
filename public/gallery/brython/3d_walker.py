from math import sin, cos, floor, pi

from browser import document as doc, html
from browser import timer, window, alert

map = None
canvas = None
overlay = None
mpos = None # mouse position
total=0
samples=25

arena=[
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,1,1,1,0,1],
    [1,0,1,0,0,0,0,1,0,1],
    [1,0,0,0,0,1,0,1,0,1],
    [1,0,1,1,0,0,0,0,0,1],
    [1,0,0,1,0,1,1,1,0,1],
    [1,1,0,1,0,0,0,1,0,1],
    [1,0,0,1,0,1,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1]
]
playerPos=[4,4] # x,y (from top left)
playerDir=0.4 # theta, facing right=0=2pi
playerPosZ=1
key=[0,0,0,0,0] # left, right, up, down

playerVelY=0
face=[]

def wallDistance(theta):
    global face
    data=[]
    face=[]
    x = playerPos[0]
    y = playerPos[1]
    
    atX=floor(x)
    atY=floor(y)

    thisRow=-1
    thisSide=-1

    lastHeight=0
    dtheta = pi/(3*samples)+2*pi

    for i in range(samples):
        # x = x+y is faster than x += y
        theta=theta+dtheta
        theta=theta+2*pi

        mapX = atX
        mapY = atY

        deltaX=1/cos(theta)
        deltaY=1/sin(theta)

        if deltaX>0:
            stepX = 1
            distX = (mapX + 1 - x) * deltaX
        else:
            stepX = -1
            deltaX = -deltaX
            distX = (x - mapX) * (deltaX)  

        if deltaY>0:
            stepY = 1
            distY = (mapY + 1 - y) * deltaY
        else:
            stepY = -1
            deltaY = -deltaY
            distY = (y - mapY) * deltaY

        for j in range(20):
            if distX < distY:
                mapX = mapX+stepX
                if arena[mapX][mapY]:
                    if thisRow!=mapX or thisSide!=0:
                        if i>0:
                            data.append(i)
                            data.append(lastHeight)
                        data.append(i)
                        data.append(distX)
                        thisSide=0
                        thisRow=mapX
                        face.append(1+stepX)
                    lastHeight=distX
                    break
                distX = distX+deltaX
            else:
                mapY = mapY+stepY
                if arena[mapX][mapY]:
                    if thisRow!=mapY or thisSide!=1:
                        if i>0:
                            data.append(i)
                            data.append(lastHeight)
                        data.append(i)
                        data.append(distY)
                        thisSide=1
                        thisRow=mapY
                        face.append(2+stepY)
                    lastHeight=distY
                    break
                distY = distY+deltaY
    data.append(i)
    data.append(lastHeight)
    return data

c1 = 3.2
c2 = 10
c3 = 1

def drawCanvas():
    c11,c12 = 0,0
    canvas.clearRect(0,0,400, 300)

    theta = playerDir-pi/6

    wall=wallDistance(theta)

    map.beginPath()
    map.clearRect(0,0,80,80)
    map.fillStyle="#3366CC"
    map.arc(playerPos[0]*8, playerPos[1]*8, 3, 0, 2*pi, True)
    map.fill()
    map.beginPath()
    map.moveTo(8*playerPos[0], 8*playerPos[1])

    for i in range(0,len(wall),4):

        theta1=playerDir-pi/6 + pi*wall[i]/(3*samples)
        theta2=playerDir-pi/6 + pi*wall[i+2]/(3*samples)
        
        fix1 = cos(theta1-playerDir)
        fix2 = cos(theta2-playerDir)

        h=2-playerPosZ

        wallH1=100/(wall[i+1]*fix1)
        wallH2=100/(wall[i+3]*fix2)

        c = 17
        H = 150
        tl=[wall[i]*c, H-wallH1*h]
        tr=[wall[i+2]*c, H-wallH2*h]
        br=[wall[i+2]*c, tr[1]+wallH2*2]
        bl=[wall[i]*c, tl[1]+wallH1*2]
        
        shade1=floor((wallH1*c1+c2)*c3)
        if shade1>255:
            shade1=255
        shade2=floor((wallH2*c1+c2)*c3)
        if shade2>255:
            shade2=255
        
        linGrad = canvas.createLinearGradient(tl[0],0,tr[0],0)
        c11,c12 = 0,0
        if face[i//4]%2==0:
            c11,c12 = shade1,shade2
        c21,c22 = 0,0
        if face[i//4]==1:
            c21,c22 = shade1,shade2
        c31,c32 = 120,120
        if face[i//4]==2:
            c31,c32 = shade1,shade2
        linGrad.addColorStop(0, 'rgba(%s,%s,%s,1.0)' %(c11,c21,c31))
        linGrad.addColorStop(1, 'rgba(%s,%s,%s,1.0)' %(c12,c22,c32))

        canvas.beginPath()
        canvas.moveTo(tl[0], tl[1])
        canvas.lineTo(tr[0], tr[1])
        canvas.lineTo(br[0], br[1])
        canvas.lineTo(bl[0], bl[1])
        canvas.fillStyle = linGrad
        canvas.fill()
        map.lineTo(playerPos[0]*8+cos(theta1)*(wall[i+1])*8, 
            playerPos[1]*8+sin(theta1)*(wall[i+1])*8)
        map.lineTo(playerPos[0]*8+cos(theta2)*(wall[i+3])*8, 
            playerPos[1]*8+sin(theta2)*(wall[i+3])*8)

    map.fillStyle="#FF0000"
    map.fill()

nbnw = 0
def nearWall(x,y):
    # check if point (x,y) is near a wall
    global nbnw
    nbnw = nbnw+1
    for i in [-0.1,0.1]:
        xx=floor(x+i)
        for j in [-0.1,0.1]:
            yy=floor(y+j)
            if arena[xx][yy]:
                return True
    return False

xOff = 0
yOff = 0
def wobbleGun():
    global xOff,yOff
    mag=playerVelY
    xOff = 10+cos(total/6.23)*mag*90
    yOff = 10+cos(total/5)*mag*90
    overlay.style.backgroundPosition = "%spx %spx" %(int(xOff),int(yOff))

jumpCycle=0

def shoot():
    canvas.save()
    canvas.strokeStyle = "#FFFF00"
    canvas.beginPath()
    
    canvas.moveTo(190+xOff, 140+yOff)
    canvas.lineTo(250+xOff, 200+yOff)
    canvas.closePath()
    canvas.stroke()
    canvas.restore()
    timer.set_timeout(drawCanvas,100)

def update():
    global total,jumpCycle,playerVelY,playerDir
    total = total+1
    change=False

    if jumpCycle:
        jumpCycle = jumpCycle - 1
        change=True
        playerPosZ = 1 + jumpCycle*(20-jumpCycle)/110
    elif key[4]:
        jumpCycle=20
    
    if key[0]:
        if not key[1]:
            playerDir = playerDir-0.07 # left
            change=True
    elif key[1]:
        playerDir = playerDir+0.07 # right
        change=True

    if change:
        playerDir = playerDir+2*pi
        playerDir = playerDir % (2*pi)
        doc["sky"].style.backgroundPosition="%spx 0" %floor(1-playerDir/(2*pi)*2400)

    if key[2] and not key[3]:
        if playerVelY<0.1:
            playerVelY = playerVelY + 0.02
    elif key[3] and not key[2]:
        if playerVelY>-0.1:
            playerVelY = playerVelY - 0.02
    else:
        if playerVelY<-0.02:
            playerVelY = playerVelY + 0.015
        elif playerVelY>0.02:
            playerVelY = playerVelY - 0.015
        else:
            playerVelY=0
    
    if playerVelY!=0:
        oldX=playerPos[0]
        oldY=playerPos[1]
        newX=oldX+cos(playerDir)*playerVelY
        newY=oldY+sin(playerDir)*playerVelY

        if not nearWall(newX, oldY):
            playerPos[0]=newX
            change=True
        if not nearWall(oldX, newY):
            playerPos[1]=newY
            change=True
    
    if playerVelY:
        wobbleGun()
    if change:
        drawCanvas()

def changeKey(which, to):
    if which==65 or which==37: # left
        key[0]=to
    elif which==87 or which==38: # up
        key[2]=to
    elif which==68 or which==39: # right
        key[1]=to
    elif which==83 or which==40: # down
        key[3]=to
    elif which==32: # space bar
        key[4]=to

def stop():
    global key
    key = [0,0,0,0,0]
    
def move(x):
    changeKey(x,1)
    timer.set_timeout(stop,50)
# put "move" in Javascript namespace, for inline event callbacks
window.move = move

def key_down(e):
    if not e:
        e = win.event
    changeKey(e.keyCode,1)
    e.preventDefault()
    e.stopPropagation()

def key_up(e):
    if not e:
        e = win.event
    changeKey(e.keyCode, 0)
    e.preventDefault()
    e.stopPropagation()

def mouse_up(e):
    global key,mpos
    key = [0,0,0,0,0]
    mpos = None
    e.preventDefault()
    e.stopPropagation()

def mouse_down(e):
    global mpos
    mpos = [e.x,e.y]
    e.preventDefault()
    e.stopPropagation()
    
def mouse_move(e):
    global mpos
    if mpos==None:
        return
    x,y = mpos
    mpos = [e.x,e.y]
    if x==mpos[0]:
        if mpos[1]-y>0:
            key[3] = 1 # down
        elif mpos[1]-y<0:
            key[2] = 1 # up
    elif y==mpos[1]:
        if mpos[0]-x>0:    
            key[1] = 1 # right
            key[0] = 0
        else:
            key[0] = 1 # left
            key[1] = 0
    e.preventDefault()
    e.stopPropagation()
        
doc.onkeydown = key_down
doc.onkeyup = key_up
doc.onmousedown = mouse_down
doc.ontouchstart = mouse_down
doc.onmousemove = mouse_move
doc.ontouchmove = mouse_move
doc.onmouseup = mouse_up
doc.ontouchup = mouse_up

def initUnderMap():
    underMap=doc["underMap"].getContext("2d")
    underMap.fillStyle="#FFF"
    underMap.fillRect(0,0, 200, 200)
    underMap.fillStyle="#444"
    for i in range(len(arena)):
        for j in range(len(arena[i])):
            if arena[i][j]:
                underMap.fillRect(i*8, j*8, 8, 8)

def init():
    global canvas,overlay,map,mpos
    #ele = doc["map"]
    #if not ele.getContext:
    #  alert('An error occured creating a Canvas 2D context. '
    #      'This may be because you are using an old browser')
    #  return    
    #map=ele.getContext("2d")

    _css=doc.createElement('link')
    _css.type="text/css"
    _css.rel="stylesheet"
    _css.href="gallery/brython/css/3Dwalker.css"

    doc['pydiv'] <= _css 

    _app = html.DIV(id="app")
    _app <= html.CANVAS(id="underMap", width="80px", height="80px")
    _app <= html.CANVAS(id="map", width="80px", height="80px")

    doc['pydiv'] <= html.DIV(id="content")
    doc['content'] <= _app

    _app <= html.DIV(id='holder')

    doc['holder']<=html.DIV(id='sky')
    doc['holder']<=html.DIV(id='floor')
    doc['holder']<=html.CANVAS(id='canvas', width="400px", height="300px")
    doc['holder']<=html.DIV(id='overlay')
    canvas=doc["canvas"].getContext("2d")
    overlay=doc["overlay"]
    map=doc["map"].getContext('2d')
    doc["sky"].style.backgroundPosition="%spx 0" %floor(-playerDir/(2*pi)*2400)
    drawCanvas()
    initUnderMap()
    timer.set_interval(update, 35)

init()

print("click on the &lt;div id='pydiv'&gt; tab to see the output")
