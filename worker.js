import indexHtml from './public/index.html';
import lootHtml from './public/loot.html';
import registerHtml from './public/register.html';
import attackHtml from './public/attack.html';
import evacHtml from './public/evac.html';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // === 页面路由 ===
    if (request.method === 'GET') {
      if (path === '/' || path === '/index.html') {
        return new Response(indexHtml, { headers: { 'Content-Type': 'text/html' } });
      }
      if (path === '/register.html') {
        return new Response(registerHtml, { headers: { 'Content-Type': 'text/html' } });
      }
      if (path === '/loot.html') {
        return new Response(lootHtml, { headers: { 'Content-Type': 'text/html' } });
      }
      if (path === '/attack.html') {
        return new Response(attackHtml, { headers: { 'Content-Type': 'text/html' } });
      }
      if (path === '/evac.html') {
        return new Response(evacHtml, { headers: { 'Content-Type': 'text/html' } });
      }
    }

    // === API: 注册玩家 ===
    if (path === '/register') {
      const token = crypto.randomUUID();
      const playerData = {
        hp: { head: 100, chest: 100, back: 100 },
        money: 0,
        alive: true,
      };
      await env.GAME_KV.put(`player:${token}`, JSON.stringify(playerData));
      return Response.json({ token });
    }

    // === API: 获取物资 ===
    if (path === '/loot') {
      const token = url.searchParams.get('token');
      const id = url.searchParams.get('id');
      if (!token || !id) return new Response("Missing token or id", { status: 400 });

      const key = `player:${token}`;
      const player = await env.GAME_KV.get(key, "json");
      if (!player || !player.alive) return new Response("Invalid player", { status: 403 });

      const isHigh = parseInt(id) >= 61;
      const gain = isHigh
        ? 200000 + Math.floor(Math.random() * 150000)
        : 10000 + Math.floor(Math.random() * 20000);

      player.money += gain;
      await env.GAME_KV.put(key, JSON.stringify(player));

      return Response.json({ gain, total: player.money });
    }

    // === API: 攻击玩家（扫码击杀） ===
    if (path === '/attack') {
      const token = url.searchParams.get("token");
      const target = url.searchParams.get("target");
      const part = url.searchParams.get("part"); // head / chest / back

      if (!token || !target || !part) return new Response("Missing params", { status: 400 });

      const targetKey = `player:${target}`;
      const targetData = await env.GAME_KV.get(targetKey, "json");
      if (!targetData || !targetData.alive) return new Response("Target invalid", { status: 400 });

      if (targetData.hp[part] === 0) {
        return new Response("Already disabled", { status: 400 });
      }

      targetData.hp[part] = 0;

      // 判断是否出局
      if (Object.values(targetData.hp).every(hp => hp === 0)) {
        targetData.alive = false;

        const killerKey = `player:${token}`;
        const killer = await env.GAME_KV.get(killerKey, "json");
        if (killer && killer.alive) {
          killer.money += targetData.money;
          await env.GAME_KV.put(killerKey, JSON.stringify(killer));
        }

        targetData.money = 0;
      }

      await env.GAME_KV.put(targetKey, JSON.stringify(targetData));
      return Response.json({ success: true, target: targetData });
    }

    // === API: 撤离 ===
    if (path === '/evac') {
      const token = url.searchParams.get("token");
      if (!token) return new Response("Missing token", { status: 400 });

      const playerKey = `player:${token}`;
      const player = await env.GAME_KV.get(playerKey, "json");
      if (!player || !player.alive) return new Response("Invalid", { status: 400 });

      player.alive = false;
      await env.GAME_KV.put(playerKey, JSON.stringify(player));

      return Response.json({ success: true, money: player.money });
    }

    return new Response("Not found", { status: 404 });
  }
};