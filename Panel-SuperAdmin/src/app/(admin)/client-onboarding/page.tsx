"use client"

import { useState } from 'react'

type UiMessage = { kind: 'ok' | 'error'; text: string } | null

export default function ClientOnboardingPage() {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<UiMessage>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setPending(true)
    const form = event.currentTarget

    const formData = new FormData(form)
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      legal_name: String(formData.get('legal_name') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      owner_full_name: String(formData.get('owner_full_name') ?? '').trim(),
      owner_email: String(formData.get('owner_email') ?? '').trim(),
      owner_password: String(formData.get('owner_password') ?? ''),
      secretary_full_name: String(formData.get('secretary_full_name') ?? '').trim(),
      secretary_email: String(formData.get('secretary_email') ?? '').trim(),
      secretary_password: String(formData.get('secretary_password') ?? ''),
      doctor_full_name: String(formData.get('doctor_full_name') ?? '').trim(),
      doctor_email: String(formData.get('doctor_email') ?? '').trim(),
      doctor_password: String(formData.get('doctor_password') ?? ''),
      doctor_specialty: String(formData.get('doctor_specialty') ?? '').trim(),
      doctor_matricula: String(formData.get('doctor_matricula') ?? '').trim(),
      doctor_ai_tag: String(formData.get('doctor_ai_tag') ?? '').trim(),
    }

    try {
      const response = await fetch('/api/client-onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(String(body?.error ?? 'No se pudo crear cliente'))

      form.reset()
      setMessage({ kind: 'ok', text: 'Cliente creado con éxito. Credenciales operativas generadas.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Error de red' })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Alta de Cliente</h2>
        <p className="mt-1 text-sm text-slate-500">
          Alta operativa completa de clínica, secretaria y médico desde este único panel.
        </p>
      </div>

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <input name="name" required placeholder="Clinica" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="legal_name" placeholder="Razon social" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="email" type="email" placeholder="Email clinica" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="phone" placeholder="Telefono" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="owner_full_name" required placeholder="Responsable" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="owner_email" required type="email" placeholder="Email acceso dueño" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="owner_password" required type="password" minLength={8} placeholder="Contrasena dueño" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <p className="mt-5 text-sm font-semibold text-slate-900">Secretaria (opcional)</p>
        <div className="mt-2 grid gap-4 lg:grid-cols-3">
          <input name="secretary_full_name" placeholder="Nombre secretaria" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="secretary_email" type="email" placeholder="Email secretaria" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="secretary_password" type="password" minLength={8} placeholder="Contrasena secretaria" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <p className="mt-5 text-sm font-semibold text-slate-900">Doctor (opcional)</p>
        <div className="mt-2 grid gap-4 lg:grid-cols-3">
          <input name="doctor_full_name" placeholder="Nombre doctor" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="doctor_email" type="email" placeholder="Email doctor" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="doctor_password" type="password" minLength={8} placeholder="Contrasena doctor" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="doctor_specialty" placeholder="Especialidad" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="doctor_matricula" placeholder="Matricula" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="doctor_ai_tag" placeholder="AI Tag (opcional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Creando...' : 'Crear cliente'}
          </button>
        </div>

        {message ? (
          <p
            className={`mt-4 rounded-md border px-3 py-2 text-sm ${
              message.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </form>
    </div>
  )
}
