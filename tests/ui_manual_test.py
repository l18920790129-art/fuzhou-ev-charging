"""
端到端 UI 测试：
1) 打开首页 → 切到地图选址
2) 在 manualLat / manualLng 输入 26.0500, 119.3000，点确认
3) 验证：selectedLocationBar 显示, actionButtons 显示, scoreValue 非 "--"
"""
import asyncio
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8000/"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await ctx.new_page()
        page.on("console", lambda m: print("[console]", m.type, m.text[:200]) if m.type in ("error", "warning") else None)

        await page.goto(URL, wait_until='domcontentloaded')
        # 切到 地图选址 tab
        await page.click('button.nav-tab[data-tab="map"]')
        await page.wait_for_selector('#manualLat', timeout=5000)
        # 等待 AMap 加载完，确保 STATE.mapInstance 就绪
        await page.wait_for_timeout(3500)

        # === 测试1：手动输入合法坐标 ===
        await page.fill('#manualLat', '')
        await page.fill('#manualLng', '')
        await page.fill('#manualLat', '26.05')
        await page.fill('#manualLng', '119.30')
        await page.click('button.btn-confirm')
        await page.wait_for_timeout(15000)

        loc_bar = await page.is_visible('#selectedLocationBar')
        action_btns = await page.is_visible('#actionButtons')
        score_card = await page.is_visible('#quickScoreCard')
        score_val = await page.inner_text('#scoreValue')
        location_status = await page.inner_text('#locationStatus')
        bar_disp = await page.eval_on_selector('#selectedLocationBar', 'el => el.style.display')
        card_disp = await page.eval_on_selector('#quickScoreCard', 'el => el.style.display')
        st_lat = await page.evaluate('window.STATE && STATE.selectedLat')
        st_lng = await page.evaluate('window.STATE && STATE.selectedLng')
        print(f'[1] 26.05,119.30 -> bar={loc_bar}({bar_disp}) btns={action_btns} card={score_card}({card_disp}) score={score_val!r} status={location_status!r} STATE=({st_lat},{st_lng})')

        # === 测试2：禁区点（鼓山林地中心）应显示 — 不显示 0.0 ===
        await page.fill('#manualLat', '26.0934')
        await page.fill('#manualLng', '119.3812')
        await page.click('button.btn-confirm')
        await page.wait_for_timeout(5000)
        score_val2 = await page.inner_text('#scoreValue')
        grade2 = await page.inner_text('#scoreGrade')
        print(f'[2] 26.0934,119.3812 (鼓山林地) -> score={score_val2!r} grade={grade2!r}')

        # === 测试3：超界坐标应被警告，不发起评分 ===
        await page.fill('#manualLat', '20.0')
        await page.fill('#manualLng', '119.3')
        await page.click('button.btn-confirm')
        await page.wait_for_timeout(1500)
        # 没有 toast 抓取也没关系，主要确保上一次结果保留
        score_val3 = await page.inner_text('#scoreValue')
        print(f'[3] 20.0,119.3 (超界) -> score 仍然 = {score_val3!r}（应保持上一次的"—"）')

        await page.screenshot(path='/tmp/ui_test.png', full_page=True)
        await browser.close()

asyncio.run(main())
