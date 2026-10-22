/**
 * dsh-model-probe, browser half: registers the plugin's own entry in the host
 * settings dialog under the `settings.section` slot (dsh 0.1.1+). A host that
 * never declares the slot never runs the registration, so nothing changes there.
 * The section renders the endpoint form, the three-state badge, evidence summary,
 * and history list; all data comes from the node half's authenticated routes.
 */

import { ModelProbeSection } from './section.tsx'

/** Loose slot registry, declared locally to avoid a host type dependency. */
interface LooseSlots {
  inject(name: string, register: () => () => void): unknown
  register(options: Record<string, unknown>, component: (props: never) => unknown): () => void
}

/** Client plugin name. */
export const name = 'dsh-model-probe'

/** Required client service: the slot registry, declared so a strict host resolves `ctx.slots`. */
export const inject = ['slots']

/**
 * Register the settings section. Waiting on the hole's declaration mirrors the
 * official registrants: entry application order is loader-driven, and a direct
 * register racing the declaration fails boot.
 * @param ctx - client root context.
 */
export function apply(ctx: { slots?: LooseSlots }): void {
  const slots = ctx.slots
  if (slots === undefined) return
  slots.inject('settings.section', () => slots.register(
    {
      name: 'settings.section',
      id: 'dsh-model-probe',
      order: 95,
      label: () => '模型核验 · Model Probe',
    },
    ModelProbeSection,
  ))
}
