import asyncio
import os

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

# ── Конфигурация ─────────────────────────────────────────────────────
BOT_TOKEN = os.environ["BOT_TOKEN"]
API_BASE = os.environ.get("API_BASE", "http://web:3000")
BOT_API_KEY = os.environ.get("BOT_API_KEY", "")
SITE_URL = os.environ.get("SITE_URL", "")
HEADERS = {"x-bot-key": BOT_API_KEY}

bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()


def menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🚀 Создать сервер", callback_data="create")],
            [InlineKeyboardButton(text="📦 Мои серверы", callback_data="servers")],
            [InlineKeyboardButton(text="💳 Тарифы", callback_data="tariffs")],
        ]
    )


class CreateFlow(StatesGroup):
    name = State()
    nickname = State()
    password = State()


WELCOME = (
    "👋 Привет! Это <b>Goh Hosting</b> — хостинг Telegram-ботов с работой 24/7.\n\n"
    "Здесь можно создать сервер для своего бота и управлять им. "
    "Выбери действие:"
)


@dp.message(CommandStart())
async def cmd_start(m: Message) -> None:
    await m.answer(WELCOME, reply_markup=menu_kb())


@dp.callback_query(F.data == "tariffs")
async def cb_tariffs(c: CallbackQuery) -> None:
    await c.message.answer(
        "💳 <b>Тарифы</b>\n\n"
        "<b>Бесплатный</b>\n"
        "• 150 МБ оперативной памяти\n"
        "• 1 сервер\n"
        "• Работа и защита 24/7\n\n"
        "Доступен один раз.",
        reply_markup=menu_kb(),
    )
    await c.answer()


@dp.callback_query(F.data == "servers")
async def cb_servers(c: CallbackQuery) -> None:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"{API_BASE}/api/internal/servers",
                params={"telegramId": c.from_user.id},
                headers=HEADERS,
            )
        data = r.json()
    except Exception:
        await c.message.answer("⚠️ Сервис временно недоступен, попробуйте позже.")
        await c.answer()
        return

    if not data.get("registered"):
        await c.message.answer(
            "У тебя пока нет аккаунта. Нажми «🚀 Создать сервер».",
            reply_markup=menu_kb(),
        )
        await c.answer()
        return

    servers = data.get("servers", [])
    site = data.get("siteUrl") or SITE_URL
    if not servers:
        await c.message.answer("📦 Серверов пока нет. Создай первый!", reply_markup=menu_kb())
        await c.answer()
        return

    status_map = {"running": "🟢 онлайн", "stopped": "⚪ оффлайн", "error": "🔴 ошибка"}
    lines = [f"📦 <b>Твои серверы</b>\nВход на сайт: <code>{data.get('nickname')}</code>\n"]
    for s in servers:
        st = status_map.get(s.get("status"), s.get("status", "?"))
        lines.append(
            f"• <b>{s['name']}</b> — {st}  ({s.get('ram', 0)}/{s.get('ramLimit', 150)} МБ)"
        )
    if site:
        lines.append(f"\n🌐 Управление: {site}/panel")
    await c.message.answer("\n".join(lines), reply_markup=menu_kb())
    await c.answer()


@dp.callback_query(F.data == "create")
async def cb_create(c: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(CreateFlow.name)
    await c.message.answer("📝 Введи <b>название сервера</b> (например: Мой бот):")
    await c.answer()


@dp.message(CreateFlow.name)
async def flow_name(m: Message, state: FSMContext) -> None:
    if not m.text:
        await m.answer("Введите название текстом:")
        return
    await state.update_data(name=m.text.strip())
    await state.set_state(CreateFlow.nickname)
    await m.answer(
        "👤 Придумай <b>никнейм</b> для входа на сайт\n"
        "(латиница, цифры и _, минимум 3 символа):"
    )


@dp.message(CreateFlow.nickname)
async def flow_nick(m: Message, state: FSMContext) -> None:
    if not m.text:
        await m.answer("Введите никнейм текстом:")
        return
    await state.update_data(nickname=m.text.strip())
    await state.set_state(CreateFlow.password)
    await m.answer("🔑 Придумай <b>пароль</b> для входа на сайт (минимум 4 символа):")


@dp.message(CreateFlow.password)
async def flow_pass(m: Message, state: FSMContext) -> None:
    if not m.text:
        await m.answer("Введите пароль текстом:")
        return
    data = await state.get_data()
    name = data.get("name")
    nickname = data.get("nickname")
    password = m.text.strip()
    await state.clear()

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{API_BASE}/api/internal/create-server",
                json={
                    "telegramId": m.from_user.id,
                    "name": name,
                    "nickname": nickname,
                    "password": password,
                },
                headers=HEADERS,
            )
        data = r.json()
    except Exception:
        await m.answer("⚠️ Сервис временно недоступен, попробуйте позже.", reply_markup=menu_kb())
        return

    if not data.get("ok"):
        await m.answer(
            f"❌ {data.get('error', 'Не удалось создать сервер')}",
            reply_markup=menu_kb(),
        )
        return

    site = data.get("siteUrl") or SITE_URL
    await m.answer(
        "✅ <b>Сервер создан!</b>\n\n"
        f"📦 Сервер: <b>{data['server']['name']}</b>\n"
        "💳 Тариф: Бесплатный (150 МБ, 24/7)\n\n"
        "🔐 <b>Данные для входа на сайт:</b>\n"
        f"🌐 Адрес: {site}\n"
        f"👤 Никнейм: <code>{data.get('nickname')}</code>\n"
        f"🔑 Пароль: <code>{password}</code>\n\n"
        "Зайди на сайт, войди этими данными — там твой сервер, "
        "файлы бота, кнопки запуска и логи.",
        reply_markup=menu_kb(),
    )


async def main() -> None:
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
