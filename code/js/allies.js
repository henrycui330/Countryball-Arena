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
        y: owner.y,
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
        vy: 0,
        grounded: true,
        wrath: !!o.wrath,
      };
      list.push(ally);
      console.log("[CBAllies] spawn " + ally.name + (ally.wrath ? " (Wrath)" : ""));
    });
  }

  function clamp(ent, W, H, map) {
    if (window.CBMaps && window.CBMaps.applyGroundPhysics) {
      window.CBMaps.applyGroundPhysics(ent, map, W, H, 0, { skipGravity: true });
      return;
    }
    const groundY = H * 0.72;
    const minY = ent.radius + 16;
    const maxY = groundY - 6;
    ent.x = Math.max(ent.radius, Math.min(W - ent.radius, ent.x));
    ent.y = Math.max(minY, Math.min(maxY, ent.y));
  }

  function update(dt, foe, W, H, map) {
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
      const dx = tx - a.x;
      const distX = Math.abs(dx) || 1;
      const nx = dx >= 0 ? 1 : -1;
      a.facing = nx;

      if (a.phase === "slam") {
        a.slamTimer -= dt;
        a.x += nx * 420 * dt;
        if (hasFoe && distX < a.radius + (foe.radius || 38) + 4) {
          foe.hp = Math.max(0, foe.hp - SLAM_DAMAGE);
          foe.flash = 0.25;
          foe.x += nx * 10;
          if (foe.vy != null) foe.vy = Math.min(foe.vy || 0, -120);
          if (window.CBEffects) {
            window.CBEffects.spawnBurst(a.x, a.y, 12, a.wrath
              ? ["#ff1a1a", "#ff4d4d", "#8b0000"]
              : ["#d52b1e", "#fff", "#0039a6"]);
          }
          console.log(
            "[CBAllies] " + a.name + " slam dmg=" + SLAM_DAMAGE + " foeHp=" + foe.hp
          );
          a.phase = "fight";
        } else if (a.slamTimer <= 0) {
          a.phase = "fight";
        }
      } else {
        const prefer = 48 + (a.id.charCodeAt(a.id.length - 1) % 5) * 6;
        if (hasFoe) {
          let mx = 0;
          if (distX > prefer + 12) mx = nx;
          else if (distX < prefer - 10) mx = -nx;
          else mx = (a.id.charCodeAt(a.id.length - 1) || 0) % 2 === 0 ? 1 : -1;
          a.x += mx * MOVE_SPEED * dt;

          a.meleeTimer -= dt;
          const dist = Math.hypot(foe.x - a.x, foe.y - a.y);
          if (a.meleeTimer <= 0 && dist < prefer + 18) {
            a.meleeTimer = MELEE_CD + Math.random() * 0.15;
            foe.hp = Math.max(0, foe.hp - MELEE_DAMAGE);
            foe.flash = 0.15;
            if (window.CBEffects) {
              window.CBEffects.spawnParticle(foe.x, foe.y, {
                vx: nx * 40,
                vy: -20,
                life: 0.15,
                size: 3,
                color: a.wrath ? "#ff1a1a" : "#fff",
              });
              if (a.wrath) {
                window.CBEffects.spawnParticle(a.x, a.y, {
                  vx: (Math.random() - 0.5) * 30,
                  vy: -40,
                  life: 0.2,
                  size: 3,
                  color: "#ff4d4d",
                });
              }
            }
          }
        }
      }

      if (window.CBMaps && window.CBMaps.applyGroundPhysics) {
        window.CBMaps.applyGroundPhysics(a, map, W, H, dt);
      } else {
        clamp(a, W, H, map);
      }
    }
  }

  function draw(ctx) {
    for (const a of list) {
      const size = a.radius * 2;
      const floatY = a.wrath ? -4 + Math.sin(Date.now() / 220 + a.x * 0.02) * 2 : 0;
      if (a.wrath) {
        ctx.save();
        const g = ctx.createRadialGradient(
          a.x,
          a.y + floatY,
          a.radius * 0.4,
          a.x,
          a.y + floatY,
          a.radius * 2.1
        );
        g.addColorStop(0, "rgba(255, 40, 40, 0.35)");
        g.addColorStop(1, "rgba(255, 0, 0, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(a.x, a.y + floatY, a.radius * 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(a.x, a.y + floatY);
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
        ctx.arc(a.x, a.y + floatY, a.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tiny HP pip
      const bw = 28;
      const bh = 4;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(a.x - bw / 2, a.y + floatY - a.radius - 10, bw, bh);
      ctx.fillStyle = "#3ecf6e";
      ctx.fillRect(
        a.x - bw / 2,
        a.y + floatY - a.radius - 10,
        bw * Math.max(0, a.hp / a.maxHp),
        bh
      );
    }
  }

  return { clear, spawnBrotherhood, update, draw, getList };
})();
