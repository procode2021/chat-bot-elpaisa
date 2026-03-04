import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Query,
  StreamableFile,
  Put
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile, writeFile } from 'fs/promises';
import { BotStateService } from '../infrastructure/bot-state.service';
import type { Appointment } from '../../appointments/domain/appointment';
import type { AppointmentRepository } from '../../appointments/domain/ports';
import { APPOINTMENTS_TOKENS } from '../../appointments/appointments.tokens';
import * as ExcelJS from 'exceljs';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly config: ConfigService,
    private readonly botState: BotStateService,
    @Inject(APPOINTMENTS_TOKENS.AppointmentRepository) private readonly appointments: AppointmentRepository
  ) { }

  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  ui() {
    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Panel Admin · Chatbot</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
</head>
<body class="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 text-slate-900">
  <div class="mx-auto max-w-7xl p-5 sm:p-6">
    <div class="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex items-start gap-3">
          <div class="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">A</div>
          <div>
            <h1 class="text-xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p class="text-sm text-slate-600">Configura el bot, respuestas rápidas y exporta citas.</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span id="state" class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm">Estado: ...</span>
          <button id="toggle" type="button" class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">Cambiar estado</button>
          <button id="reload" type="button" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50">Recargar</button>
          <button id="save" type="button" class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500">Guardar</button>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs font-medium text-slate-500">Bot</div>
          <div id="kpiBot" class="mt-1 text-lg font-semibold text-slate-900">—</div>
          <div class="mt-1 text-xs text-slate-500">Encendido / apagado</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs font-medium text-slate-500">Citas (cargadas)</div>
          <div id="kpiApptTotal" class="mt-1 text-lg font-semibold text-slate-900">—</div>
          <div class="mt-1 text-xs text-slate-500">Últimas citas visibles</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs font-medium text-slate-500">Citas (hoy)</div>
          <div id="kpiApptToday" class="mt-1 text-lg font-semibold text-slate-900">—</div>
          <div class="mt-1 text-xs text-slate-500">Según createdAt</div>
        </div>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
      <aside class="hidden lg:col-span-3 lg:block">
        <div class="sticky top-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs font-semibold tracking-wide text-slate-500">NAVEGACIÓN</div>
          <nav class="mt-3 space-y-1 text-sm">
            <a href="#section-business" class="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Datos del negocio</a>
            <a href="#section-qr" class="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50 font-medium text-indigo-600">WhatsApp QR</a>
            <a href="#section-bot" class="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Bot</a>
            <a href="#section-quick" class="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Respuestas rápidas</a>
            <a href="#section-appointments" class="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Citas</a>
            <a href="#section-advanced" class="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Avanzado</a>
          </nav>
          <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Recomendación: usa “Guardar” después de editar secciones.
          </div>
        </div>
      </aside>

      <main class="lg:col-span-9">
        <div id="section-business" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold">Datos del negocio</h2>
              <p class="text-sm text-slate-600">Se guardan en el servidor.</p>
            </div>
            <div id="hint" class="text-xs text-slate-500"></div>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="text-xs font-medium text-slate-700">Nombre</label>
              <input id="name" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="Óptica Visión Clara" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Teléfono</label>
              <input id="phone" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="+57 300 000 0000" />
            </div>

            <div class="sm:col-span-2">
              <label class="text-xs font-medium text-slate-700">Descripción</label>
              <textarea id="description" class="mt-1 min-h-[110px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="Describe el negocio..."></textarea>
            </div>

            <div>
              <label class="text-xs font-medium text-slate-700">Horario (local)</label>
              <input id="hoursStore" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="Lunes a Viernes 8:00am - 6:00pm | Sábados 9:00am - 1:00pm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Horario (asistente)</label>
              <input id="hoursAssistant" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="Disponible 24/7..." />
            </div>

            <div class="sm:col-span-2">
              <label class="text-xs font-medium text-slate-700">Dirección</label>
              <input id="address" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="Calle 123 #45-67, Bogotá, Colombia." />
            </div>

            <div>
              <label class="text-xs font-medium text-slate-700">Latitud</label>
              <input id="lat" inputmode="decimal" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="4.711" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Longitud</label>
              <input id="lng" inputmode="decimal" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="-74.0721" />
            </div>

            <div>
              <label class="text-xs font-medium text-slate-700">WhatsApp</label>
              <input id="whatsapp" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="+57 300 000 0000" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Correo</label>
              <input id="email" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="contacto@visionclara.com" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Instagram</label>
              <input id="instagram" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="@visionclara" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700">Facebook</label>
              <input id="facebook" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="Óptica Visión Clara" />
            </div>

            <div class="sm:col-span-2">
              <label class="text-xs font-medium text-slate-700">Servicios (1 por línea)</label>
              <textarea id="services" class="mt-1 min-h-[110px] w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="Examen visual...\nAdaptación de lentes..."></textarea>
            </div>
            <div class="sm:col-span-2">
              <label class="text-xs font-medium text-slate-700">Promociones (1 por línea)</label>
              <textarea id="promotions" class="mt-1 min-h-[110px] w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="10%...\n2x1..."></textarea>
            </div>

            <div class="sm:col-span-2" id="section-qr">
              <label class="text-xs font-medium text-slate-700">Autenticación WhatsApp (QR)</label>
              <div id="qrContainer" class="mt-2 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                <div id="qrPlaceholder" class="text-center">
                  <p class="text-sm text-slate-500">Si el bot requiere autenticación, el código QR aparecerá aquí.</p>
                </div>
                <div id="qrImageContainer" class="hidden">
                  <div id="qrCanvas" class="bg-white p-2 shadow-sm rounded-lg"></div>
                  <p class="mt-3 text-xs text-slate-500 text-center">Escanea este código desde WhatsApp</p>
                </div>
              </div>
            </div>

            <div class="sm:col-span-2" id="section-bot">
              <label class="text-xs font-medium text-slate-700">Instrucciones del bot</label>
              <textarea id="botInstructions" class="mt-1 min-h-[110px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" placeholder="Ej: Si el usuario dice 'hola', responde 'Buenos días, ¿cómo estás?'"></textarea>
            </div>
          </div>
        </div>

        <div id="section-quick" class="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-base font-semibold">Respuestas rápidas</h2>
              <p class="text-sm text-slate-600">Crea respuestas listas (trigger + reply). Puedes agregar más.</p>
            </div>
            <button id="addQuickReply" type="button" class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Agregar</button>
          </div>
          <div id="quickReplies" class="mt-3 space-y-3"></div>
        </div>

        <div id="section-appointments" class="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-base font-semibold">Citas</h2>
              <p class="text-sm text-slate-600">Vista rápida y exportación (Excel/CSV).</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <input id="apptSearch" placeholder="Buscar por nombre, cc, teléfono..." class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 sm:w-72" />
              <button id="apptReload" type="button" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50">Recargar</button>
              <button id="apptExport" type="button" class="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500">Exportar</button>
            </div>
          </div>
          <div class="mt-3 overflow-auto rounded-xl border border-slate-200">
            <table class="min-w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-600">
                <tr>
                  <th class="whitespace-nowrap px-3 py-2 font-medium">Fecha</th>
                  <th class="whitespace-nowrap px-3 py-2 font-medium">Nombre</th>
                  <th class="whitespace-nowrap px-3 py-2 font-medium">Cc</th>
                  <th class="whitespace-nowrap px-3 py-2 font-medium">Teléfono</th>
                  <th class="whitespace-nowrap px-3 py-2 font-medium">Día</th>
                  <th class="whitespace-nowrap px-3 py-2 font-medium">Hora</th>
                </tr>
              </thead>
              <tbody id="apptTbody" class="divide-y divide-slate-100 bg-white"></tbody>
            </table>
          </div>
          <div class="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
            <div id="apptHint"></div>
            <div>Tip: “Exportar” descarga CSV para Excel.</div>
          </div>
        </div>

        <div class="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-base font-semibold">Estado y mensajes</h2>
          <p class="mt-1 text-sm text-slate-600">Resultados de guardado o errores.</p>
          <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div id="msg" class="text-sm text-slate-700"></div>
            <pre id="err" class="mt-2 hidden overflow-auto rounded-lg bg-white p-3 text-xs text-rose-700"></pre>
          </div>
        </div>

        <div id="section-advanced" class="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <details class="rounded-xl border border-slate-200 bg-white p-3">
            <summary class="cursor-pointer text-sm font-medium text-slate-800">Avanzado: ver/editar JSON</summary>
            <div class="mt-3">
              <textarea id="json" spellcheck="false" class="min-h-[320px] w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"></textarea>
              <p class="mt-2 text-xs text-slate-500">Tip: el botón “Guardar” sobrescribe el JSON del servidor.</p>
            </div>
          </details>
        </div>
      </main>
    </div>
  </div>

  <script>
    const headers = { 'content-type': 'application/json' };
    const $ = (id) => document.getElementById(id);

    function clearNode(el) {
      while (el && el.firstChild) el.removeChild(el.firstChild);
    }

    function normalizeQuickReply(item) {
      if (!item) return { trigger: '', reply: '' };
      if (typeof item === 'string') return { trigger: '', reply: String(item) };
      const trigger = typeof item.trigger === 'string' ? item.trigger : (typeof item.when === 'string' ? item.when : '');
      const reply =
        typeof item.reply === 'string'
          ? item.reply
          : typeof item.text === 'string'
            ? item.text
            : typeof item.response === 'string'
              ? item.response
              : '';
      return { trigger: String(trigger || ''), reply: String(reply || '') };
    }

    function renderQuickReplies(list) {
      const root = $('quickReplies');
      clearNode(root);
      const items = Array.isArray(list) ? list : [];
      if (items.length === 0) addQuickReplyRow({ trigger: '', reply: '' });
      else items.map(normalizeQuickReply).forEach(addQuickReplyRow);
    }

    function addQuickReplyRow(item) {
      const root = $('quickReplies');
      const wrap = document.createElement('div');
      wrap.className = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

      const row = document.createElement('div');
      row.className = 'grid grid-cols-1 gap-3 md:grid-cols-5';

      const left = document.createElement('div');
      left.className = 'md:col-span-2';
      const lblT = document.createElement('label');
      lblT.className = 'text-xs font-medium text-slate-700';
      lblT.textContent = 'Trigger (palabras clave)';
      const inpT = document.createElement('input');
      inpT.className = 'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100';
      inpT.placeholder = 'Ej: horario / está abierto / cita / agendar';
      inpT.value = (item && item.trigger) ? String(item.trigger) : '';
      inpT.setAttribute('data-qr-trigger', '1');
      left.appendChild(lblT);
      left.appendChild(inpT);

      const right = document.createElement('div');
      right.className = 'md:col-span-3';
      const lblR = document.createElement('label');
      lblR.className = 'text-xs font-medium text-slate-700';
      lblR.textContent = 'Reply (respuesta)';
      const inpR = document.createElement('textarea');
      inpR.className = 'mt-1 min-h-[110px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100';
      inpR.placeholder = 'Respuesta que enviará el bot...';
      inpR.value = (item && item.reply) ? String(item.reply) : '';
      inpR.setAttribute('data-qr-reply', '1');
      right.appendChild(lblR);
      right.appendChild(inpR);

      const actions = document.createElement('div');
      actions.className = 'md:col-span-5 flex items-center justify-end gap-2';
      const lblA = document.createElement('label');
      lblA.className = 'sr-only';
      lblA.textContent = 'Acciones';
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Eliminar';
      del.className = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50';
      del.onclick = () => wrap.remove();
      actions.appendChild(del);

      row.appendChild(left);
      row.appendChild(right);
      wrap.appendChild(row);
      wrap.appendChild(actions);
      root.appendChild(wrap);
    }

    function readQuickRepliesFromUI() {
      const root = $('quickReplies');
      const triggers = Array.from(root.querySelectorAll('[data-qr-trigger]'));
      return triggers
        .map((triggerEl) => {
          const card = triggerEl.closest('.card');
          const replyEl = card ? card.querySelector('[data-qr-reply]') : null;
          const trigger = String(triggerEl.value || '').trim();
          const reply = replyEl ? String(replyEl.value || '').trim() : '';
          if (!trigger && !reply) return null;
          return { trigger, reply };
        })
        .filter(Boolean);
    }

    function linesToArray(text) {
      return String(text || '')
        .split(/\\r?\\n/)
        .map(s => s.trim())
        .filter(Boolean);
    }

    function arrayToLines(arr) {
      if (!Array.isArray(arr)) return '';
      return arr.map(String).join('\\n');
    }

    function parseNumber(value) {
      const n = Number(String(value ?? '').replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    }

    function buildBusinessInfo() {
      const lat = parseNumber($('lat').value);
      const lng = parseNumber($('lng').value);

      if (lat == null || lng == null) {
        throw new Error('Latitud/Longitud inválidas. Usa números como 4.711 y -74.0721.');
      }

      return {
        business: {
          name: $('name').value.trim(),
          description: $('description').value.trim(),
          hours: {
            store: $('hoursStore').value.trim(),
            virtualAssistant: $('hoursAssistant').value.trim()
          },
          location: {
            address: $('address').value.trim(),
            lat,
            lng
          },
          contact: {
            phone: $('phone').value.trim(),
            whatsapp: $('whatsapp').value.trim(),
            email: $('email').value.trim()
          },
          social: {
            instagram: $('instagram').value.trim(),
            facebook: $('facebook').value.trim()
          },
          services: linesToArray($('services').value),
          promotions: linesToArray($('promotions').value)
        },
        bot: {
          instructions: $('botInstructions').value.trim(),
          quickReplies: readQuickRepliesFromUI()
        }
      };
    }

    function fillForm(data) {
      const b = data && data.business ? data.business : (data || {});
      const hours = b.hours || {};
      const loc = b.location || {};
      const contact = b.contact || {};
      const social = b.social || {};
      const bot = data && data.bot ? data.bot : {};

      $('name').value = b.name || '';
      $('description').value = b.description || '';
      $('hoursStore').value = hours.store || '';
      $('hoursAssistant').value = hours.virtualAssistant || '';
      $('address').value = loc.address || '';
      $('lat').value = loc.lat ?? '';
      $('lng').value = loc.lng ?? '';
      $('phone').value = contact.phone || '';
      $('whatsapp').value = contact.whatsapp || '';
      $('email').value = contact.email || '';
      $('instagram').value = social.instagram || '';
      $('facebook').value = social.facebook || '';
      $('services').value = arrayToLines(b.services);
      $('promotions').value = arrayToLines(b.promotions);
      $('botInstructions').value = bot.instructions || '';
      renderQuickReplies(bot.quickReplies);
    }

    function setMsg(text, isError=false, details='') {
      $('msg').textContent = text || '';
      $('err').className = details ? 'mt-2 overflow-auto rounded-lg bg-white p-3 text-xs text-rose-700' : 'hidden';
      $('err').textContent = details || '';
      $('msg').className = isError ? 'text-sm font-medium text-rose-700' : 'text-sm text-slate-700';
    }

    async function loadState() {
      const r = await fetch('/admin/state', { headers });
      if (!r.ok) throw new Error(await r.text());
      const s = await r.json();
      $('state').textContent = 'Estado: ' + (s.enabled ? 'ACTIVO' : 'INACTIVO');
      $('state').className = s.enabled
        ? 'inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800'
        : 'inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-800';
      $('toggle').textContent = s.enabled ? 'Desactivar bot' : 'Activar bot';
      $('kpiBot').textContent = s.enabled ? 'Activo' : 'Inactivo';
      return s;
    }

    async function toggleState() {
      const s = await loadState();
      const r = await fetch('/admin/state', { method:'PUT', headers, body: JSON.stringify({ enabled: !s.enabled })});
      if (!r.ok) throw new Error(await r.text());
      await loadState();
      setMsg('Estado actualizado.');
    }

    async function loadJson() {
      const r = await fetch('/admin/business-info', { headers });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      $('json').value = JSON.stringify(data, null, 2);
      fillForm(data);
      setMsg('JSON cargado.');
    }

    async function saveJson() {
      try {
        const built = buildBusinessInfo();
        $('json').value = JSON.stringify(built, null, 2);
        const r = await fetch('/admin/business-info', { method:'PUT', headers, body: JSON.stringify(built) });
        if (!r.ok) throw new Error(await r.text());
        setMsg('JSON guardado.');
      } catch (e) {
        setMsg('Error guardando JSON.', true, String(e && e.message ? e.message : e));
      }
    }

    function formatDateTime(iso) {
      try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return String(iso || '');
        return d.toLocaleString();
      } catch {
        return String(iso || '');
      }
    }

    function escapeHtml(s) {
      return String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    let __appointments = [];

    function isSameDay(a, b) {
      return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
      );
    }

    function updateKpis(items) {
      try {
        $('kpiApptTotal').textContent = String(items.length);
        const now = new Date();
        const todayCount = items.filter((x) => {
          const d = new Date(x.createdAt);
          return !Number.isNaN(d.getTime()) && isSameDay(d, now);
        }).length;
        $('kpiApptToday').textContent = String(todayCount);
      } catch {}
    }

    function renderAppointments(list) {
      const tbody = $('apptTbody');
      tbody.innerHTML = '';
      const items = Array.isArray(list) ? list : [];
      items.forEach((a) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="whitespace-nowrap px-3 py-2 text-slate-700">' +
          escapeHtml(formatDateTime(a.createdAt)) +
          '</td>' +
          '<td class="whitespace-nowrap px-3 py-2 text-slate-700">' +
          escapeHtml(a.name) +
          '</td>' +
          '<td class="whitespace-nowrap px-3 py-2 text-slate-700">' +
          escapeHtml(a.cc) +
          '</td>' +
          '<td class="whitespace-nowrap px-3 py-2 text-slate-700">' +
          escapeHtml(a.phone) +
          '</td>' +
          '<td class="whitespace-nowrap px-3 py-2 text-slate-700">' +
          escapeHtml(a.day) +
          '</td>' +
          '<td class="whitespace-nowrap px-3 py-2 text-slate-700">' +
          escapeHtml(a.time) +
          '</td>';
        tbody.appendChild(tr);
      });
      $('apptHint').textContent = items.length ? ('Mostrando ' + items.length + ' citas.') : 'No hay citas.';
      updateKpis(items);
    }

    function applyAppointmentsFilter() {
      const q = String($('apptSearch').value || '').trim().toLowerCase();
      if (!q) return renderAppointments(__appointments);
      const filtered = __appointments.filter((a) => {
        const hay = [a.name, a.cc, a.phone, a.day, a.time].map((x) => String(x || '').toLowerCase()).join(' ');
        return hay.includes(q);
      });
      renderAppointments(filtered);
    }

    async function loadAppointments() {
      const r = await fetch('/admin/appointments?limit=200', { headers });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      __appointments = Array.isArray(data.items) ? data.items : [];
      applyAppointmentsFilter();
    }

    $('toggle').onclick = () => toggleState().catch(e => setMsg('Error.', true, String(e)));
    $('reload').onclick = () => loadJson().catch(e => setMsg('Error.', true, String(e)));
    $('save').onclick = () => saveJson().catch(e => setMsg('Error.', true, String(e)));
    $('addQuickReply').onclick = () => addQuickReplyRow({ trigger: '', reply: '' });
    $('apptReload').onclick = () => loadAppointments().catch(e => setMsg('Error cargando citas.', true, String(e)));
    $('apptExport').onclick = () => {
      const url = '/admin/appointments.xlsx?limit=2000';
      window.open(url, '_blank');
    };
    $('apptSearch').oninput = () => applyAppointmentsFilter();

    async function loadQr() {
      const r = await fetch('/admin/qr', { headers });
      if (!r.ok) return;
      const { qr } = await r.json();
      const placeholder = $('qrPlaceholder');
      const imgContainer = $('qrImageContainer');
      const canvas = $('qrCanvas');

      if (qr) {
        placeholder.classList.add('hidden');
        imgContainer.classList.remove('hidden');
        clearNode(canvas);
        const c = document.createElement('canvas');
        canvas.appendChild(c);
        QRCode.toCanvas(c, qr, { width: 256, margin: 2 }, (err) => {
          if (err) console.error(err);
        });
      } else {
        placeholder.classList.remove('hidden');
        imgContainer.classList.add('hidden');
      }
    }

    setInterval(loadQr, 5000);

    Promise.all([loadState(), loadJson(), loadAppointments(), loadQr()]).catch(e => setMsg('Error inicializando.', true, String(e)));
  </script>
</body>
</html>`;
  }

  @Get('state')
  state() {
    return { enabled: this.botState.isEnabled() };
  }

  @Put('state')
  setState(
    @Body() body: any
  ) {
    this.botState.setEnabled(Boolean(body?.enabled));
    return { enabled: this.botState.isEnabled() };
  }

  @Get('business-info')
  async getBusinessInfo() {
    const path = this.config.get<string>('BUSINESS_INFO_PATH') ?? 'business-info.json';
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  }

  @Put('business-info')
  async setBusinessInfo(
    @Body() body: unknown
  ) {
    const path = this.config.get<string>('BUSINESS_INFO_PATH') ?? 'business-info.json';
    const serialized = JSON.stringify(body, null, 2);
    await writeFile(path, serialized + '\n', 'utf-8');
    return { ok: true };
  }

  @Get('qr')
  getQr() {
    return { qr: this.botState.getQrCode() };
  }

  @Get('appointments')
  async listAppointments(@Query('limit') limit?: string) {
    const items = await this.appointments.list({ limit: Number(limit ?? 200) });
    return { items };
  }

  @Get('appointments.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  async exportAppointmentsCsv(@Query('limit') limit?: string): Promise<string> {
    const items = await this.appointments.list({ limit: Number(limit ?? 2000) });

    const esc = (v: unknown) => {
      const s = String(v ?? '');
      const needs = s.includes(',') || s.includes('\n') || s.includes('\r') || s.includes('"');
      const out = s.replaceAll('"', '""');
      return needs ? `"${out}"` : out;
    };

    const header = ['createdAt', 'name', 'cc', 'phone', 'day', 'time', 'user'].join(',');
    const rows = items.map((a: Appointment) =>
      [
        esc(a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt)),
        esc(a.name),
        esc(a.cc),
        esc(a.phone),
        esc(a.day),
        esc(a.time),
        esc(a.user)
      ].join(',')
    );
    return [header, ...rows].join('\n') + '\n';
  }

  @Get('appointments.xlsx')
  @Header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('content-disposition', 'attachment; filename="appointments.xlsx"')
  async exportAppointmentsXlsx(@Query('limit') limit?: string): Promise<StreamableFile> {
    const items = await this.appointments.list({ limit: Number(limit ?? 2000) });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'chatbot-ddd';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Appointments', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'Created At', key: 'createdAt', width: 24 },
      { header: 'Name', key: 'name', width: 26 },
      { header: 'CC', key: 'cc', width: 16 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Day', key: 'day', width: 18 },
      { header: 'Time', key: 'time', width: 14 },
      { header: 'User', key: 'user', width: 22 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length }
    };

    for (const a of items) {
      sheet.addRow({
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
        name: a.name,
        cc: a.cc,
        phone: a.phone,
        day: a.day,
        time: a.time,
        user: a.user
      });
    }

    const buf = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as any);
    return new StreamableFile(buffer);
  }
}
