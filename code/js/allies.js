/**
 * Russia ult allies: Kazakhstan, Belarus, Ukraine.
 * Slam into foe, then fight for a limited time. Small = hard to hit.
 */
window.CBAllies = (function () {
  const list = [];
  const RADIUS = 17;
  const MAX_HP = 42;
  const SLAM_DAMAGE = 14;
  const MELEE_DAMAGE = 5;
  const MELEE_CD = 0.55;
  const MOVE_SPEED = 175;

  function clear() {
    list.length = 0;
  }

  function getList() {
    return list;
  }

  function spawnBrotherhood(opts) {
    const o = opts || {};
    const owner = o.owner;
    const target = o.target;
    const life = o.life ?? 30;
    const allies = o.allies || [];
    if (!owner) return;

    clear();
    const baseAng = Math.atan2(
      (target ? target.y : owner.y) - owner.y,
      (target ? target.x : owner.x + 120) - owner.x
    );

    allies.forEach(function (spec, i) {
      const spread = (i - (allies.length - 1) / 2) * 0.55;
      const ang = baseAng + spread;
      const spawnDist = owner.radius + 28;
      const ally = {
        id: spec.id || "ally-" + i,
        name: spec.name || "Ally",
        ownerId: owner.id,
        x: owner.x + Math.cos(ang) * spawnDist,
        y: owner.y + Math.sin(ang) * spawnDist,
        radius: RADIUS,
        hp: MAX_HP,
        maxHp: MAX_HP,
        flash: 0,
        img: spec.img || null,
        life: life,
        maxLife: life,
        phase: "slam",
        slamTimer: 0.35 + i * 0.08,
        meleeTimer: 0.2 + i * 0.1,
        facing: 1,
        invuln: false,
        stunned: false,
      };
      list.push(ally);
      console.log("[CBAllies] spawn " + ally.name);
    });
  }

  function clamp(ent, W, H) {
    const groundY = H * 0.72;
    const minY = ent.radius + 16;
    const maxY = groundY - 6;
    ent.x = Math.max(ent.radius, Math.min(W - ent.radius, ent.x));
    ent.y = Math.max(minY, Math.min(maxY, ent.y));
  }

  function update(dt, foe, W, H) {
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      a.life -= dt;
      if (a.flash > 0) a.flash = Math.max(0, a.flash - dt);

      if (a.hp <= 0 || a.life <= 0) {
        if (window.CBEffects) {
          window.CBEffects.spawnBurst(a.x, a.y, 10, ["#fff", "#888", "#0039a6"]);
        }
        console.log("[CBAllies] " + a.name + " down");
        list.splice(i, 1);
        continue;
      }

      const hasFoe = foe && foe.hp > 0;
      const tx = hasFoe ? foe.x : a.x;
      const ty = hasFoe ? foe.y : a.y;
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      a.facing = dx >= 0 ? 1 : -1;

      if (a.phase === "slam") {
        a.slamTimer -= dt;
        a.x += nx * 420 * dt;
        a.y += ny * 420 * dt;
        if (hasFoe && dist < a.radius + (foe.radius || 38) + 4) {
          foe.hp = Math.max(0, foe.hp - SLAM_DAMAGE);
          foe.flash = 0.25;
          foe.x += nx * 10;
          foe.y += ny * 6;
          if (window.CBEffects) {
            window.CBEffects.spawnBurst(a.x, a.y, 12, [
              "#d52b1e",
              "#fff",
              "#0039a6",
            ]);
          }
          console.log(
            "[CBAllies] " + a.name + " slam dmg=" + SLAM_DAMAGE + " foeHp=" + foe.hp
          );
          a.phase = "fight";
        } else if (a.slamTimer <= 0) {
          a.phase = "fight";
        }
      } else {
        // Orbit / pressure fight
        const prefer = 48 + (a.id.charCodeAt(a.id.length - 1) % 5) * 6;
        let mx = 0;
        let my = 0;
        if (hasFoe) {
          if (dist > prefer + 12) {
            mx = nx;
            my = ny;
          } else if (dist < prefer - 10) {
            mx = -nx;
            my = -ny;
          } else {
            mx = -ny;
            my = nx;
          }
          const len = Math.hypot(mx, my) || 1;
          a.x += (mx / len) * MOVE_SPEED * dt;
          a.y += (my / len) * MOVE_SPEED * dt;

          a.meleeTimer -= dt;
          if (a.meleeTimer <= 0 && dist < prefer + 18) {
            a.meleeTimer = MELEE_CD + Math.random() * 0.15;
            foe.hp = Math.max(0, foe.hp - MELEE_DAMAGE);
            foe.flash = 0.15;
            if (window.CBEffects) {
              window.CBEffects.spawnParticle(foe.x, foe.y, {
                vx: nx * 40,
                vy: ny * 40,
                life: 0.15,
                size: 3,
                color: "#fff",
              });
            }
          }
        }
      }

      clamp(a, W, H);
    }
  }

  function draw(ctx) {
    for (const a of list) {
      const size = a.radius * 2;
      ctx.save();
      ctx.translate(a.x, a.y);
      if (a.facing < 0) ctx.scale(-1, 1);
      if (a.img && a.img.complete && a.img.naturalWidth) {
        ctx.drawImage(a.img, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = "#0039a6";
        ctx.beginPath();
        ctx.arc(0, 0, a.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (a.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, a.flash * 3)})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tiny HP pip
      const bw = 28;
      const bh = 4;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(a.x - bw / 2, a.y - a.radius - 10, bw, bh);
      ctx.fillStyle = "#3ecf6e";
      ctx.fillRect(
        a.x - bw / 2,
        a.y - a.radius - 10,
        bw * Math.max(0, a.hp / a.maxHp),
        bh
      );
    }
  }

  return { clear, spawnBrotherhood, update, draw, getList };
})();
