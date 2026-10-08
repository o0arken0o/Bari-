import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {constrainTarget,createCameraFloor,stopOrbitMotion,groundPose} from '../lib/camera-safety.ts';
const bounds={minX:-10,maxX:10,minZ:-20,maxZ:20};
const geo=(x,z)=>({lon:16.867+x/3350,lat:41.127-z/4440});
const rectangle=(a,b,c,d)=>[geo(a,c),geo(b,c),geo(b,d),geo(a,d)];
test('a long pan remains within bounds without changing its viewing offset',()=>{const target=new THREE.Vector3(100,0,-200),camera=new THREE.Vector3(103,8,-196),offset=camera.clone().sub(target);assert.equal(constrainTarget(camera,target,bounds),true);assert.deepEqual(target.toArray(),[10,0,-20]);assert.ok(camera.clone().sub(target).distanceTo(offset)<1e-9);});
test('ordinary movement inside the area remains unchanged',()=>{const target=new THREE.Vector3(2,0,4),camera=new THREE.Vector3(5,8,8);assert.equal(constrainTarget(camera,target,bounds),false);assert.deepEqual(camera.toArray(),[5,8,8]);});
test('camera clearance respects a roof, its courtyard and nearby open ground',()=>{const floor=createCameraFloor([{id:'one',geometry:rectangle(-1,1,-1,1),holes:[rectangle(-.2,.2,-.2,.2)],tags:{}}],new Map([['one',.8]]));assert.ok(Math.abs(floor(new THREE.Vector3(.5,0,.5))-.92)<1e-9);assert.equal(floor(new THREE.Vector3(0,0,0)),.12);assert.equal(floor(new THREE.Vector3(2,0,2)),.12);});
test('overlapping rendered roofs use the highest surface and omit unrendered records',()=>{const record=id=>({id,geometry:rectangle(-1,1,-1,1),tags:{}});const floor=createCameraFloor([record('low'),record('high'),record('absent')],new Map([['low',.5],['high',1.4]]));assert.ok(Math.abs(floor(new THREE.Vector3(.5,0,.5))-1.52)<1e-9);});

test('a scripted view cancels residual pan without moving the current view',()=>{const camera=new THREE.PerspectiveCamera(39,1,.08,1800);camera.position.set(12,9,15);const controls=new OrbitControls(camera,null);controls.enableDamping=true;controls.dampingFactor=.075;controls.domElement={clientWidth:800,clientHeight:600};controls.pan(300,200);const position=camera.position.clone(),target=controls.target.clone();stopOrbitMotion(camera,controls);assert.equal(controls.enableDamping,true);assert.ok(camera.position.distanceTo(position)<1e-9);assert.ok(controls.target.distanceTo(target)<1e-9);for(let i=0;i<10;i++)controls.update();assert.ok(camera.position.distanceTo(position)<1e-9);assert.ok(controls.target.distanceTo(target)<1e-9);});
test('the squad pose reaches a ground target without losing its viewing offset',()=>{const position=new THREE.Vector3(3,.65,4),target=new THREE.Vector3(2,.02,3);const pose=groundPose(position,target);assert.equal(pose.target.y,0);assert.ok(pose.position.clone().sub(pose.target).distanceTo(position.clone().sub(target))<1e-9);assert.equal(target.y,.02);assert.equal(position.y,.65);});
