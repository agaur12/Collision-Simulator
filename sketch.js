// AP Physics C Collision Simulator
const particles = []; // Array to store all particles
let selectedParticle = null; // Currently selected particle
let paused = true; // Simulation pause state - default to paused
let lastUpdateTime = 0; // For frame-rate independent physics
let subSteps = 8; // Increased sub-steps for more accurate collisions
let particleCounter = 0; // Counter for naming particles
let showLabels = false; // Toggle for displaying particle property labels - default OFF

// Collision elasticity coefficients (now stored as decimal values internally)
let particleElasticity = 1.0; // Coefficient of restitution for particle-particle collisions - default to 100%
let wallElasticity = 1.0; // Coefficient of restitution for wall collisions - default to 100%
let dragVelocityHandle = false; // Flag for dragging velocity vector

// Physics constants
const POSITION_CORRECTION_FACTOR = 0.2; // How much to correct position overlaps (0-1)
const MAX_VELOCITY = 1000; // Max velocity to prevent instability

function setup() {
  // Create canvas and place it in the container
  const canvas = createCanvas(800, 600);
  canvas.parent('canvas-container');

  // Set up UI event handlers
  select('#addParticle').mousePressed(addParticle);
  select('#removeParticle').mousePressed(removeSelectedParticle);
  select('#resetSim').mousePressed(resetSimulation);
  select('#pauseSim').mousePressed(togglePause);
  select('#pauseSim').html('Play'); // Set initial button text to "Play"

  // Set initial values for elasticity sliders
  select('#ePartValue').html(select('#ePart').value() + '%');
  select('#eWallValue').html(select('#eWall').value() + '%');

  // Set up elasticity sliders with percentage value display
  select('#ePart').input(function() {
    particleElasticity = this.value() / 100; // Convert from percentage to decimal
    select('#ePartValue').html(this.value() + '%');
    console.log("Particle elasticity updated:", particleElasticity);
  });

  select('#eWall').input(function() {
    wallElasticity = this.value() / 100; // Convert from percentage to decimal
    select('#eWallValue').html(this.value() + '%');
    console.log("Wall elasticity updated:", wallElasticity);
  });

  // Set up toggle for particle labels using click handler instead of changed
  const labelsToggle = select('#showLabels');

  if (labelsToggle) {
    // Use mousePressed event which is more reliable than changed for checkboxes
    labelsToggle.elt.addEventListener('click', function() {
      // Toggle the state
      showLabels = !showLabels;

      // Apply the state to the checkbox
      labelsToggle.elt.checked = showLabels;

      console.log("Toggle now:", showLabels);
    });

    // Set initial state (ensuring checkbox starts in OFF position)
    showLabels = false;
    labelsToggle.elt.checked = showLabels;
  } else {
    console.log("Warning: Could not find #showLabels element");
  }

  // Set up particle property inputs
  select('#mass').input(updateSelectedParticleProperties);
  select('#speed').input(updateSelectedParticleProperties);
  select('#angle').input(updateSelectedParticleProperties);

  // Initial setup with default particles
  resetSimulation();

  // Canvas resizing to fit container
  windowResized();
}

function windowResized() {
  const container = select('#canvas-container');
  if (container) {
    resizeCanvas(container.width, container.height);
  }
}

function resetSimulation() {
  // Clear particles and reset values
  particles.length = 0;
  selectedParticle = null;
  paused = true; // Default to paused on reset
  select('#pauseSim').html('Play');

  // Update elasticity values from sliders (converting from percentage to decimal)
  particleElasticity = select('#ePart').value() / 100;
  wallElasticity = select('#eWall').value() / 100;

  // Add two default particles with greater spacing to clearly see velocity vectors
  const centerX = width / 2;
  const centerY = height / 2;
  const spacing = 100; // Increased spacing between particles

  // First particle positioned to the left of center with rightward velocity
  addParticleAt(centerX - spacing, centerY, 1.0, 20, 0);
  // Second particle positioned to the right of center with leftward velocity
  const p2 = addParticleAt(centerX + spacing, centerY, 1.0, 20, 180);

  // Select P2
  selectedParticle = p2;
}

function addParticle() {
  // Add a particle where the mouse is, or at a random position if mouse is outside canvas
  const x = (mouseX > 0 && mouseX < width) ? mouseX : random(width * 0.1, width * 0.9);
  const y = (mouseY > 0 && mouseY < height) ? mouseY : random(height * 0.1, height * 0.9);

  addParticleAt(x, y, 1.0, 50, 0);
}

function addParticleAt(x, y, mass, speed, angle) {
  // Create a new particle and add it to the array
  const p = new Particle(x, y, mass, speed, radians(angle));
  particles.push(p);

  // Select the new particle
  selectedParticle = p;
  updateParticlePropertiesUI();

  return p;
}

function removeSelectedParticle() {
  if (selectedParticle) {
    const index = particles.indexOf(selectedParticle);
    if (index !== -1) {
      particles.splice(index, 1);
      selectedParticle = null;
    }
  }
}

function togglePause() {
  paused = !paused;
  select('#pauseSim').html(paused ? 'Play' : 'Pause');

  // Reset last update time to prevent large time steps when unpausing
  lastUpdateTime = millis() / 1000;
}

function draw() {
  background(18); // Dark background to match UI theme

  // Draw subtle grid for better depth perception
  drawGrid();

  if (!paused) {
    // Physics update step with current time delta
    const currentTime = millis() / 1000; // Convert to seconds
    const deltaTime = currentTime - lastUpdateTime;
    lastUpdateTime = currentTime;

    // Use a reasonable max delta to prevent huge jumps if tab was inactive
    const maxDelta = 1 / 30; // Max 30fps equivalent
    const dt = min(deltaTime, maxDelta);

    updatePhysics(dt);
  } else {
    // If paused, still update the time so resume doesn't jump
    lastUpdateTime = millis() / 1000;
  }

  // Draw particles and calculate system totals
  let totalKE = 0;
  let totalMomentumX = 0;
  let totalMomentumY = 0;

  // Particle individual data for system panel
  let particlesData = '';

  // Loop through all particles to draw them and calculate system data
  for (let p of particles) {
    p.draw();

    // Calculate system totals
    const ke = p.getKineticEnergy();
    const momentum = p.getMomentum();
    totalKE += ke;
    totalMomentumX += momentum.x;
    totalMomentumY += momentum.y;

    // Build particle data string
    const speed = p.getSpeed().toFixed(1);
    const vx = p.velocity.x.toFixed(1);
    const vy = p.velocity.y.toFixed(1);

    // Create color swatch
    const r = red(p.color);
    const g = green(p.color);
    const b = blue(p.color);

    particlesData += `
      <div style="margin-top:8px; padding:8px; border-radius:4px; 
                  background-color:rgba(40,40,40,0.7); border-left:4px solid rgb(${r},${g},${b})">
        <div style="font-weight:bold; margin-bottom:4px; display:flex; justify-content:space-between">
          <span>${p.name}</span>
          <span style="color:rgb(${r},${g},${b})">●</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:12px">
          <div>Mass:</div><div>${p.mass.toFixed(1)} kg</div>
          <div>Speed:</div><div>${speed} m/s</div>
          <div>Velocity:</div><div>(${vx}, ${vy})</div>
          <div>KE:</div><div>${ke.toFixed(1)} J</div>
        </div>
      </div>`;
  }

  // Update system data display with enhanced formatting and particle data
  const systemDataElement = select('#systemData');
  if (systemDataElement) {
    systemDataElement.html(
      `<div style="font-weight:bold; margin-bottom:8px; padding-bottom:8px; 
                  border-bottom:1px solid #444; color:#03dac6">
         SYSTEM TOTALS
       </div>
       <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px">
         <div>Total KE:</div><div>${totalKE.toFixed(1)} J</div>
         <div>Total Pₓ:</div><div>${totalMomentumX.toFixed(1)} kg·m/s</div>
         <div>Total Pᵧ:</div><div>${totalMomentumY.toFixed(1)} kg·m/s</div>
       </div>
       ${particles.length > 0 ? 
          `<div style="font-weight:bold; margin:12px 0 8px; padding-bottom:8px; 
                      border-bottom:1px solid #444; color:#03dac6">
             PARTICLE DATA
           </div>
           ${particlesData}` 
        : 
          '<div style="font-style:italic; opacity:0.7; text-align:center; margin-top:12px">No particles</div>'
       }
      `
    );
  } else {
    console.log("Warning: Could not find #systemData element");
  }
}

// Draw a subtle grid on the background
function drawGrid() {
  stroke(40); // Subtle grid lines
  strokeWeight(1);

  // Draw vertical lines
  const gridSize = 50;
  for (let x = gridSize; x < width; x += gridSize) {
    line(x, 0, x, height);
  }

  // Draw horizontal lines
  for (let y = gridSize; y < height; y += gridSize) {
    line(0, y, width, y);
  }
}

function updatePhysics(dt) {
  // Divide the time step for more accurate collision detection
  const subDt = dt / subSteps;

  for (let step = 0; step < subSteps; step++) {
    // First update positions
    for (let p of particles) {
      p.update(subDt);
    }

    // Then check for and resolve collisions
    resolveCollisions(subDt);
  }
}

function resolveCollisions(dt) {
  // First check wall collisions
  for (let p of particles) {
    p.checkWallCollision(wallElasticity);
  }

  // Then check particle-particle collisions - improved to handle multiple iterations
  const iterations = 2; // Multiple iterations for better stability
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        checkCollision(particles[i], particles[j], particleElasticity);
      }
    }
  }
}

function checkCollision(particleA, particleB, elasticity) {
  // Get vector between particles (from A to B)
  const collisionVector = p5.Vector.sub(particleB.position, particleA.position);
  const distance = collisionVector.mag();

  // Sum of radii
  const minDistance = particleA.radius + particleB.radius;

  // If particles are not overlapping, no collision
  if (distance >= minDistance) return false;

  // Avoid division by zero for coincident particles
  if (distance < 0.01) {
    // Slightly separate coincident particles in a random direction
    const randomDir = p5.Vector.random2D();
    particleA.position.add(p5.Vector.mult(randomDir, -minDistance * 0.6));
    particleB.position.add(p5.Vector.mult(randomDir, minDistance * 0.6));
    return true;
  }

  // Normalize the collision vector
  const collisionNormal = collisionVector.copy().div(distance);

  // Get the relative velocity of the particles
  const relVelocity = p5.Vector.sub(particleB.velocity, particleA.velocity);

  // Calculate the relative velocity along the normal
  const normalVelocity = relVelocity.dot(collisionNormal);

  // If particles are moving away from each other, no collision response needed
  if (normalVelocity > 0) return false;

  // Calculate restitution (coefficient of elasticity)
  const e = elasticity;

  // Calculate impulse scalar
  // j = -(1 + e) * normalVelocity / (1/m1 + 1/m2)
  const j = -(1 + e) * normalVelocity / (particleA.inverseMass + particleB.inverseMass);

  // Calculate impulse vector
  const impulse = p5.Vector.mult(collisionNormal, j);

  // Apply impulse to change velocities
  particleA.velocity.sub(p5.Vector.mult(impulse, particleA.inverseMass));
  particleB.velocity.add(p5.Vector.mult(impulse, particleB.inverseMass));

  // Position correction to prevent overlap (Constraint based)
  const correction = (minDistance - distance) * POSITION_CORRECTION_FACTOR;
  const correctionVector = p5.Vector.mult(collisionNormal, correction);

  // Apply position correction based on inverse mass (heavier objects move less)
  const sumInverseMass = particleA.inverseMass + particleB.inverseMass;
  particleA.position.sub(p5.Vector.mult(correctionVector, particleA.inverseMass / sumInverseMass));
  particleB.position.add(p5.Vector.mult(correctionVector, particleB.inverseMass / sumInverseMass));

  return true;
}

function mousePressed() {
  // Only handle selection if clicked on the canvas, not on UI controls
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    // Check if we clicked on a particle
    selectedParticle = null;
    dragVelocityHandle = false;

    for (let p of particles) {
      // Check if clicked on velocity handle
      if (p.isOnVelocityHandle(mouseX, mouseY)) {
        selectedParticle = p;
        dragVelocityHandle = true;
        break;
      }

      // Check if clicked on particle body
      if (p.contains(mouseX, mouseY)) {
        selectedParticle = p;
        break;
      }
    }

    // Update UI with selected particle properties
    updateParticlePropertiesUI();
  }
}

function mouseDragged() {
  if (selectedParticle && dragVelocityHandle) {
    // Dragging velocity vector
    selectedParticle.setVelocityFromDrag(mouseX, mouseY);
    updateParticlePropertiesUI();
    return false; // Prevent default
  }
}

function mouseReleased() {
  dragVelocityHandle = false;
}

function updateParticlePropertiesUI() {
  if (selectedParticle) {
    // Update UI inputs with selected particle properties
    select('#mass').value(selectedParticle.mass);
    select('#speed').value(selectedParticle.getSpeed().toFixed(1));
    select('#angle').value(selectedParticle.getAngle().toFixed(0));
  }
}

function updateSelectedParticleProperties() {
  if (selectedParticle) {
    // Get values from UI inputs
    const mass = parseFloat(select('#mass').value());
    const speed = parseFloat(select('#speed').value());
    const angle = parseFloat(select('#angle').value());

    // Update particle properties
    selectedParticle.setMass(mass);
    selectedParticle.setVelocity(speed, radians(angle));
  }
}

// Particle class
class Particle {
  constructor(x, y, mass, speed, angle) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.fromAngle(angle).mult(speed);
    this.mass = mass;
    this.radius = this.massToRadius(mass);

    // Assign a unique ID to the particle
    this.id = ++particleCounter;
    this.name = `P${this.id}`;

    // Color for the particle
    this.color = color(random(100, 255), random(100, 255), random(100, 255));

    this.prevPosition = this.position.copy(); // For collision detection improvement
    this.inverseMass = 1 / mass; // Pre-calculate for efficiency
  }

  update(dt) {
    // Store previous position for continuous collision detection
    this.prevPosition = this.position.copy();

    // Update position based on velocity with velocity clamping for stability
    this.clampVelocity();
    this.position.add(p5.Vector.mult(this.velocity, dt));
  }

  clampVelocity() {
    // Prevent extreme velocities that can cause instability
    const speedSq = this.velocity.magSq();
    if (speedSq > MAX_VELOCITY * MAX_VELOCITY) {
      this.velocity.setMag(MAX_VELOCITY);
    }
  }

  draw() {
    push();

    // Add subtle glow effect
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), 30);
    circle(this.position.x, this.position.y, this.radius * 2.5);

    // Draw main particle circle with gradient-like effect
    if (this === selectedParticle) {
      // Highlight selected particle with gold rim
      strokeWeight(3);
      stroke(255, 215, 0);
    } else {
      strokeWeight(1);
      stroke(200);
    }

    fill(this.color);
    circle(this.position.x, this.position.y, this.radius * 2);

    // Draw velocity vector
    this.drawVelocityVector();

    // No labels are displayed as per request

    pop();
  }

  drawVelocityVector() {
    const velScale = 1; // Scale factor for velocity visualization
    const arrowSize = 8;

    // Calculate end point of velocity vector
    const velEnd = p5.Vector.add(
      this.position,
      p5.Vector.mult(this.velocity, velScale)
    );

    // Draw arrow shaft
    stroke(255, 255, 0);
    strokeWeight(2);
    line(this.position.x, this.position.y, velEnd.x, velEnd.y);

    // Draw arrowhead
    const arrowAngle = this.velocity.heading();
    push();
    translate(velEnd.x, velEnd.y);
    rotate(arrowAngle);
    fill(255, 255, 0);
    noStroke();
    triangle(0, 0, -arrowSize * 0.8, -arrowSize/2, -arrowSize * 0.8, arrowSize/2);
    pop();

    // Draw handle
    fill(255, 50, 50);
    noStroke();
    circle(velEnd.x, velEnd.y, arrowSize);

    // Display velocity value near the vector handle
    textAlign(CENTER, CENTER);
    fill(255, 255, 0);
    textSize(12);
    text(`${this.getSpeed().toFixed(1)} m/s`, velEnd.x, velEnd.y - 12);
  }

  contains(x, y) {
    // Check if point (x,y) is inside the particle
    return dist(x, y, this.position.x, this.position.y) < this.radius;
  }

  isOnVelocityHandle(x, y) {
    // Check if point (x,y) is on the velocity handle
    const velScale = 1;
    const handleRadius = 8;

    const velEnd = p5.Vector.add(
      this.position,
      p5.Vector.mult(this.velocity, velScale)
    );

    return dist(x, y, velEnd.x, velEnd.y) < handleRadius;
  }

  setVelocityFromDrag(x, y) {
    // Set velocity based on drag position
    const newVel = createVector(x - this.position.x, y - this.position.y);
    this.velocity = newVel.copy();
  }

  getMomentum() {
    // p = m * v
    return this.velocity.copy().mult(this.mass);
  }

  getKineticEnergy() {
    // KE = 0.5 * m * v^2
    return 0.5 * this.mass * this.velocity.magSq();
  }

  getSpeed() {
    return this.velocity.mag();
  }

  getAngle() {
    // Get angle in degrees
    return degrees(this.velocity.heading());
  }

  setMass(mass) {
    // Set mass and update radius
    this.mass = max(0.1, mass); // Prevent negative or zero mass
    this.inverseMass = 1 / this.mass; // Update inverse mass
    this.radius = this.massToRadius(this.mass);
  }

  setVelocity(speed, angle) {
    // Set velocity from speed and angle
    this.velocity = p5.Vector.fromAngle(angle).mult(speed);
  }

  checkWallCollision(elasticity) {
    let collided = false;

    // Left wall
    if (this.position.x - this.radius < 0) {
      // Calculate rebound with proper elasticity
      this.position.x = this.radius;
      this.velocity.x = -this.velocity.x * elasticity;
      collided = true;
    }

    // Right wall
    if (this.position.x + this.radius > width) {
      this.position.x = width - this.radius;
      this.velocity.x = -this.velocity.x * elasticity;
      collided = true;
    }

    // Top wall
    if (this.position.y - this.radius < 0) {
      this.position.y = this.radius;
      this.velocity.y = -this.velocity.y * elasticity;
      collided = true;
    }

    // Bottom wall
    if (this.position.y + this.radius > height) {
      this.position.y = height - this.radius;
      this.velocity.y = -this.velocity.y * elasticity;
      collided = true;
    }

    return collided;
  }

  massToRadius(mass) {
    // Convert mass to visual radius (square root relationship)
    return 15 + sqrt(mass) * 10;
  }
}
