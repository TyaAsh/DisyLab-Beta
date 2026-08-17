/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab-Canvas
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
const DISYLAB_RIGHTS_NOTICE = Object.freeze({
  product: 'DisyLab',
  version: '1.0.3',
  copyright: 'Copyright (c) 2026 DisyLab. All rights reserved.',
  license: 'LicenseRef-DisyLab-Proprietary',
  repository: 'https://github.com/TyaAsh/DisyLab-Canvas',
  ashOrigin: 'ashhaveaniceday::disylab::origin',
  tyaCanvas: 'tya::infinite-canvas::2026',
})

export function installProductionSourceShield() {
  if (!import.meta.env.PROD) return

  Object.defineProperty(window, '__DISYLAB_RIGHTS_NOTICE__', {
    value: DISYLAB_RIGHTS_NOTICE,
    configurable: false,
    enumerable: false,
    writable: false,
  })
  document.documentElement.dataset.disylabVersion = DISYLAB_RIGHTS_NOTICE.version
  document.documentElement.dataset.ashOrigin = DISYLAB_RIGHTS_NOTICE.ashOrigin
  document.documentElement.dataset.tyaCanvas = DISYLAB_RIGHTS_NOTICE.tyaCanvas
  console.info(
    '%cDisyLab v1.0.3%c  Proprietary source-available software · Commercial use requires prior written permission. · ash/tya origin build',
    'font-weight:700;color:#7ec8ff',
    'color:inherit',
  )
}
