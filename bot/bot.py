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

# ── Конфигурация ────────────────────────────────────────────────────────
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
            [
                InlineKeyboardButton(text="💳 Тарифы", callback_data="tariffs"),
                InlineKeyboardButton(text="📜 Правила", callback_data="rules"),
            ],
            [InlineKeyboardButton(text="ℹ️ Помощь", callback_data="help")],
        ]
    )


class CreateFlow(StatesGroup):
    name = State()
    nickname = State()
    password = State()


WELCOME = (
    "👋 <b>Привет! Это Goh Hosting</b>\n"
    "Хостинг Telegram-ботов с защитой и работой 24/7.\n\n"
    "Здесь можно создать сервер для своего бота и управлять им прямо из Telegram.\n\n"
    "Выбери действие 👇"
)

TARIFFS_TEXT = (
    "💳 <b>Тарифы</b>\n\n"
    "🆓 <b>Бесплатный</b>\n"
    "▪️ 150 МБ оперативной памяти\n"
    "▪️ 1 Telegram-бот\n"
    "▪️ Работа и защита 24/7\n"
    "▪️ Панель управления и хранилище файлов\n\n"
    "Доступен один раз на аккаунт — жми «🚀 Создать сервер», чтобы начать."
)

HELP_TEXT = (
    "ℹ️ <b>Как это работает</b>\n\n"
    "1️⃣ Нажми «🚀 Создать сервер» и укажи название, никнейм и пароль.\n"
    "2️⃣ Войди на сайт с этими данными.\n"
    "3️⃣ Загрузи код своего бота и токен от @BotFather.\n"
    "4️⃣ Нажми «Запустить» — бот заработает 24/7.\n\n"
    "Что-то не получается? Начни заново с «🚀 Создать сервер» или загляни в «📜 Правила»."
)

RULES_TEXT = (
    "📜 <b>Правила сервиса</b>\n\n"
    "1️⃣ Один бесплатный сервер на аккаунт (150 МБ ОЗУ)\n"
    "2️⃣ Запускай только свой код — чужой и вредоносный запрещён\n"
    "3️⃣ Без спама и массовых рассылок\n"
    "4️⃣ Без майнинга, DDoS и любой незаконной активности\n"
    "5️⃣ Береги токен и пароль — не передавай третьим лицам\n\n"
    "⚠️ Нарушение правил может привести к остановке сервера."
)


async def typing(chat_id: int) -> None:
    try:
        await bot.send_chat_action(chat_id, "typing")
    except Exception:
        pass


def ram_bar(used: int, limit: int, length: int = 10) -> str:
    limit = limit or 150
    filled = max(0, min(length, round(length * used / limit))) if limit else 0
    return "▓" * filled + "░" * (length - filled)


async def animate(msg: Message, steps: list[str], interval: float = 0.7) -> None:
    for step in steps:
        await asyncio.sleep(interval)
        try:
            await msg.edit_text(step)
        except Exception:
            pass


async def safe_edit(msg: Message, text: str) -> None:
    try:
        await msg.edit_text(text)
    except Exception:
        await msg.answer(text)


@dp.message(CommandStart())
async def cmd_start(m: Message) -> None:
    await typing(m.chat.id)
    await m.answer(WELCOME, reply_markup=menu_kb())


@dp.callback_query(F.data == "menu")
async def cb_menu(c: CallbackQuery) -> None:
    await typing(c.message.chat.id)
    await c.message.answer(WELCOME, reply_markup=menu_kb())
    await c.answer()


@dp.callback_query(F.data == "tariffs")
async def cb_tariffs(c: CallbackQuery) -> None:
    await typing(c.message.chat.id)
    await c.message.answer(TARIFFS_TEXT, reply_markup=menu_kb())
    await c.answer()


@dp.callback_query(F.data == "rules")
async def cb_rules(c: CallbackQuery) -> None:
    await typing(c.message.chat.id)
    await c.message.answer(RULES_TEXT, reply_markup=menu_kb())
    await c.answer()


@dp.callback_query(F.data == "help")
async def cb_help(c: CallbackQuery) -> None:
    await typing(c.message.chat.id)
    await c.message.answer(HELP_TEXT, reply_markup=menu_kb())
    await c.answer()


@dp.callback_query(F.data == "servers")
async def cb_servers(c: CallbackQuery) -> None:
    await c.answer()
    status_msg = await c.message.answer("⏳ Загружаю твои серверы...")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"{API_BASE}/api/internal/servers",
                params={"telegramId": c.from_user.id},
                headers=HEADERS,
            )
        data = r.json()
    except Exception:
        await safe_edit(status_msg, "⚠️ Сервис временно недоступен, попробуйте позже.")
        await c.message.answer("Что дальше?", reply_markup=menu_kb())
        return

    if not data.get("registered"):
        await safe_edit(status_msg, "У тебя пока нет аккаунта. Нажми «🚀 Создать сервер».")
        await c.message.answer("Выбери действие 👇", reply_markup=menu_kb())
        return

    servers = data.get("servers", [])
    site = data.get("siteUrl") or SITE_URL
    if not servers:
        await safe_edit(status_msg, "📦 Серверов пока нет. Создай первый!")
        await c.message.answer("Выбери действие 👇", reply_markup=menu_kb())
        return

    status_map = {"running": "🟢 онлайн", "stopped": "⚪ оффлайн", "error": "🔴 ошибка"}
    lines = [f"📦 <b>Твои серверы</b>\nВход на сайт: <code>{data.get('nickname')}</code>\n"]
    for s in servers:
        st = status_map.get(s.get("status"), s.get("status", "?"))
        bar = ram_bar(s.get("ram", 0), s.get("ramLimit", 150))
        lines.append(
            f"• <b>{s['name']}</b> — {st}\n   {bar}  {s.get('ram', 0)}/{s.get('ramLimit', 150)} МБ"
        )
    if site:
        lines.append(f"\n🌐 Управление: {site}/panel")
    await safe_edit(status_msg, "\n".join(lines))
    await c.message.answer("Выбери действие 👇", reply_markup=menu_kb())


@dp.callback_query(F.data == "create")
async def cb_create(c: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(CreateFlow.name)
    await typing(c.message.chat.id)
    await c.message.answer("📝 Введи <b>название сервера</b> (например: Мой бот):")
    await c.answer()


@dp.message(CreateFlow.name)
async def flow_name(m: Message, state: FSMContext) -> None:
    if not m.text:
        await m.answer("Введите название текстом:")
        return
    await state.update_data(name=m.text.strip())
    await state.set_state(CreateFlow.nickname)
    await typing(m.chat.id)
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
    await typing(m.chat.id)
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

    status_msg = await m.answer("⏳ Создаю сервер...")
    anim_task = asyncio.create_task(
        animate(
            status_msg,
            ["🔧 Настраиваю окружение...", "📦 Разворачиваю бота...", "🚀 Почти готово..."],
        )
    )

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
        resp = r.json()
    except Exception:
        anim_task.cancel()
        await safe_edit(status_msg, "⚠️ Сервис временно недоступен, попробуйте позже.")
        await m.answer("Что дальше?", reply_markup=menu_kb())
        return

    anim_task.cancel()

    if not resp.get("ok"):
        await safe_edit(status_msg, f"❌ {resp.get('error', 'Не удалось создать сервер')}")
        await m.answer("Что дальше?", reply_markup=menu_kb())
        return

    site = resp.get("siteUrl") or SITE_URL
    await safe_edit(
        status_msg,
        "✅ <b>Сервер создан!</b>\n\n"
        f"📦 Сервер: <b>{resp['server']['name']}</b>\n"
        "💳 Тариф: Бесплатный (150 МБ, 24/7)\n\n"
        "🔐 <b>Данные для входа на сайт:</b>\n"
        f"🌐 Адрес: {site}\n"
        f"👤 Никнейм: <code>{resp.get('nickname')}</code>\n"
        f"🔑 Пароль: <code>{password}</code>\n\n"
        "Зайди на сайт, войди этими данными — там твой сервер, "
        "файлы бота, кнопки запуска и логи.",
    )
    await m.answer("Выбери действие 👇", reply_markup=menu_kb())


async def main() -> None:
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
