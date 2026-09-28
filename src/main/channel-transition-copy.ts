// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { readFileSync } from 'fs'
import { join } from 'path'

const COPY = {
  en: {
    title: 'Bespok3d Staging', closeBeta: 'Close Bespok3d Beta, then relaunch Staging to retry. Neither profile was changed.',
    cannotCheck: 'Staging could not verify whether Bespok3d Beta is closed. No profile data was copied.',
    unreadable: 'Staging could not read an encrypted Beta setting. Beta remains unchanged; relaunch Staging to retry or start Staging fresh.',
    unsafe: 'Beta profile data contains a symbolic link and was not copied. Beta remains unchanged.',
    interrupted: 'The Beta copy stopped partway. Beta remains unchanged; relaunch Staging to recover or start Staging fresh.',
    copyFailed: 'Staging could not copy the Beta profile. Beta remains unchanged; relaunch Staging to retry or start Staging fresh.',
    fresh: 'Start Staging fresh', retryLater: 'Quit and retry later', copy: 'Copy Beta data', quitLater: 'Quit and decide later',
    found: 'An existing Bespok3d Beta profile was found. Close Beta before copying. Staging copies its settings, printers, keys and app data into a separate profile. Beta stays unchanged and recoverable; existing Staging data is never merged or overwritten.',
    partial: 'A previous Beta profile copy stopped partway. Beta remains unchanged. Retry the copy, discard only the incomplete Staging copy and start fresh, or quit.',
    retry: 'Retry Beta copy', discardFresh: 'Discard and start fresh', openStaging: 'Open Staging',
    conflict: 'Staging already contains app data. Beta will not be merged into or overwrite this profile.',
  },
  fr: {
    title: 'Bespok3d Staging', closeBeta: 'Fermez Bespok3d Beta, puis relancez Staging. Aucun profil n’a été modifié.',
    cannotCheck: 'Impossible de vérifier si Bespok3d Beta est fermé. Aucune donnée de profil n’a été copiée.',
    unreadable: 'Staging ne peut pas lire un réglage Beta chiffré. Beta reste intact. Relancez Staging pour réessayer ou démarrer sans copie.',
    unsafe: 'Les données Beta contiennent un lien symbolique et n’ont pas été copiées. Beta reste intact.',
    interrupted: 'La copie de Beta s’est interrompue. Beta reste intact. Relancez Staging pour récupérer ou démarrer sans copie.',
    copyFailed: 'La copie du profil Beta a échoué. Beta reste intact. Relancez Staging pour réessayer ou démarrer sans copie.',
    fresh: 'Démarrer Staging sans copie', retryLater: 'Quitter et réessayer plus tard', copy: 'Copier les données Beta', quitLater: 'Quitter et décider plus tard',
    found: 'Un profil Bespok3d Beta existe. Fermez Beta avant la copie. Staging copiera ses réglages, imprimantes, clés et données dans un profil séparé. Beta restera intact; les données Staging existantes ne seront ni fusionnées ni remplacées.',
    partial: 'Une copie précédente de Beta s’est interrompue. Beta reste intact. Réessayez, supprimez uniquement la copie Staging incomplète pour démarrer sans copie, ou quittez.',
    retry: 'Réessayer la copie Beta', discardFresh: 'Supprimer la copie incomplète et démarrer sans copie', openStaging: 'Ouvrir Staging',
    conflict: 'Staging contient déjà des données. Le profil Beta ne sera ni fusionné ni utilisé pour le remplacer.',
  },
  de: {
    title: 'Bespok3d Staging', closeBeta: 'Schließen Sie Bespok3d Beta und starten Sie Staging erneut. Kein Profil wurde geändert.',
    cannotCheck: 'Es konnte nicht geprüft werden, ob Bespok3d Beta geschlossen ist. Es wurden keine Profildaten kopiert.',
    unreadable: 'Staging kann eine verschlüsselte Beta-Einstellung nicht lesen. Beta bleibt unverändert. Starten Sie Staging erneut oder ohne Kopie.',
    unsafe: 'Die Beta-Profildaten enthalten einen symbolischen Link und wurden nicht kopiert. Beta bleibt unverändert.',
    interrupted: 'Das Kopieren des Beta-Profils wurde unterbrochen. Beta bleibt unverändert. Starten Sie Staging zur Wiederherstellung oder ohne Kopie.',
    copyFailed: 'Das Beta-Profil konnte nicht kopiert werden. Beta bleibt unverändert. Starten Sie Staging erneut oder ohne Kopie.',
    fresh: 'Staging ohne Kopie starten', retryLater: 'Beenden und später erneut versuchen', copy: 'Beta-Daten kopieren', quitLater: 'Beenden und später entscheiden',
    found: 'Ein Bespok3d-Beta-Profil wurde gefunden. Schließen Sie Beta vor dem Kopieren. Staging kopiert Einstellungen, Drucker, Schlüssel und App-Daten in ein eigenes Profil. Beta bleibt erhalten; vorhandene Staging-Daten werden nicht zusammengeführt oder überschrieben.',
    partial: 'Ein vorheriges Kopieren wurde unterbrochen. Beta bleibt unverändert. Erneut versuchen, nur die unvollständige Staging-Kopie verwerfen und frisch starten oder beenden.',
    retry: 'Beta-Kopie erneut versuchen', discardFresh: 'Unvollständige Kopie verwerfen und frisch starten', openStaging: 'Staging öffnen',
    conflict: 'Staging enthält bereits App-Daten. Beta wird weder zusammengeführt noch zum Überschreiben verwendet.',
  },
  es: {
    title: 'Bespok3d Staging', closeBeta: 'Cierra Bespok3d Beta y vuelve a iniciar Staging. No se modificó ningún perfil.',
    cannotCheck: 'No se pudo comprobar si Bespok3d Beta está cerrado. No se copió ningún dato.',
    unreadable: 'Staging no pudo leer un ajuste cifrado de Beta. Beta sigue intacto. Reinicia Staging para reintentar o empezar sin copiar.',
    unsafe: 'Los datos de Beta contienen un enlace simbólico y no se copiaron. Beta sigue intacto.',
    interrupted: 'La copia de Beta se interrumpió. Beta sigue intacto. Reinicia Staging para recuperar o empezar sin copiar.',
    copyFailed: 'No se pudo copiar el perfil Beta. Beta sigue intacto. Reinicia Staging para reintentar o empezar sin copiar.',
    fresh: 'Empezar Staging sin copiar', retryLater: 'Salir y reintentar más tarde', copy: 'Copiar datos de Beta', quitLater: 'Salir y decidir más tarde',
    found: 'Se encontró un perfil de Bespok3d Beta. Cierra Beta antes de copiar. Staging copiará ajustes, impresoras, claves y datos de la app a un perfil separado. Beta permanecerá intacto; los datos existentes de Staging no se combinarán ni reemplazarán.',
    partial: 'Una copia anterior de Beta se interrumpió. Beta sigue intacto. Reintenta, descarta solo la copia incompleta de Staging y empieza de cero, o sal.',
    retry: 'Reintentar copia de Beta', discardFresh: 'Descartar copia incompleta y empezar de cero', openStaging: 'Abrir Staging',
    conflict: 'Staging ya contiene datos. Beta no se combinará ni se usará para reemplazar este perfil.',
  },
  ja: {
    title: 'Bespok3d Staging', closeBeta: 'Bespok3d Beta を終了して Staging を再起動してください。どちらのプロファイルも変更されていません。',
    cannotCheck: 'Bespok3d Beta が終了しているか確認できませんでした。プロファイルデータはコピーされていません。',
    unreadable: 'Staging は暗号化された Beta の設定を読み取れませんでした。Beta は変更されていません。再試行するか、新規で開始してください。',
    unsafe: 'Beta のプロファイルにシンボリックリンクが含まれるためコピーしませんでした。Beta は変更されていません。',
    interrupted: 'Beta のコピーが中断されました。Beta は変更されていません。Staging を再起動して復旧するか、新規で開始してください。',
    copyFailed: 'Beta のプロファイルをコピーできませんでした。Beta は変更されていません。再試行するか、新規で開始してください。',
    fresh: 'コピーせず Staging を開始', retryLater: '終了して後で再試行', copy: 'Beta データをコピー', quitLater: '終了して後で決定',
    found: '既存の Bespok3d Beta プロファイルが見つかりました。コピー前に Beta を終了してください。設定、プリンター、キー、アプリデータを別の Staging プロファイルへコピーします。Beta はそのまま保持され、既存の Staging データは統合も上書きもされません。',
    partial: '以前の Beta コピーが中断されました。Beta は変更されていません。再試行、不完全な Staging コピーだけを破棄して新規開始、または終了を選択してください。',
    retry: 'Beta コピーを再試行', discardFresh: '不完全なコピーを破棄して新規開始', openStaging: 'Staging を開く',
    conflict: 'Staging にはすでにデータがあります。Beta を統合したり、このプロファイルに上書きしたりしません。',
  },
  'zh-CN': {
    title: 'Bespok3d Staging', closeBeta: '请关闭 Bespok3d Beta 后重新启动 Staging。两个配置均未更改。',
    cannotCheck: '无法确认 Bespok3d Beta 是否已关闭。未复制任何配置数据。',
    unreadable: 'Staging 无法读取 Beta 的加密设置。Beta 保持不变。请重启 Staging 重试或直接开始新配置。',
    unsafe: 'Beta 配置数据包含符号链接，因此未复制。Beta 保持不变。',
    interrupted: 'Beta 配置复制中断。Beta 保持不变。请重启 Staging 恢复，或直接开始新配置。',
    copyFailed: '无法复制 Beta 配置。Beta 保持不变。请重启 Staging 重试或直接开始新配置。',
    fresh: '不复制，直接开始 Staging', retryLater: '退出，稍后重试', copy: '复制 Beta 数据', quitLater: '退出，稍后决定',
    found: '发现现有的 Bespok3d Beta 配置。复制前请关闭 Beta。Staging 会将设置、打印机、密钥和应用数据复制到独立配置中。Beta 保持不变；不会合并或覆盖现有 Staging 数据。',
    partial: '之前的 Beta 配置复制中断。Beta 保持不变。可重试、仅丢弃未完成的 Staging 副本并重新开始，或退出。',
    retry: '重试复制 Beta', discardFresh: '丢弃未完成副本并重新开始', openStaging: '打开 Staging',
    conflict: 'Staging 已包含应用数据。不会合并 Beta，也不会用 Beta 覆盖此配置。',
  },
  'pt-BR': {
    title: 'Bespok3d Staging', closeBeta: 'Feche o Bespok3d Beta e reinicie o Staging. Nenhum perfil foi alterado.',
    cannotCheck: 'Não foi possível confirmar se o Bespok3d Beta está fechado. Nenhum dado foi copiado.',
    unreadable: 'O Staging não conseguiu ler uma configuração criptografada do Beta. O Beta permanece intacto. Reinicie para tentar novamente ou iniciar sem copiar.',
    unsafe: 'Os dados do perfil Beta contêm um link simbólico e não foram copiados. O Beta permanece intacto.',
    interrupted: 'A cópia do Beta foi interrompida. O Beta permanece intacto. Reinicie o Staging para recuperar ou iniciar sem copiar.',
    copyFailed: 'Não foi possível copiar o perfil Beta. O Beta permanece intacto. Reinicie para tentar novamente ou iniciar sem copiar.',
    fresh: 'Iniciar Staging sem copiar', retryLater: 'Sair e tentar mais tarde', copy: 'Copiar dados do Beta', quitLater: 'Sair e decidir depois',
    found: 'Um perfil Bespok3d Beta existente foi encontrado. Feche o Beta antes de copiar. O Staging copiará configurações, impressoras, chaves e dados do app para um perfil separado. O Beta permanece intacto; dados existentes do Staging não serão mesclados nem substituídos.',
    partial: 'Uma cópia anterior do Beta foi interrompida. O Beta permanece intacto. Tente novamente, descarte somente a cópia incompleta do Staging e inicie do zero, ou saia.',
    retry: 'Tentar copiar Beta novamente', discardFresh: 'Descartar cópia incompleta e iniciar do zero', openStaging: 'Abrir Staging',
    conflict: 'O Staging já contém dados. O Beta não será mesclado nem usado para substituir este perfil.',
  },
  it: {
    title: 'Bespok3d Staging', closeBeta: 'Chiudi Bespok3d Beta e riavvia Staging. Nessun profilo è stato modificato.',
    cannotCheck: 'Impossibile verificare che Bespok3d Beta sia chiuso. Non è stato copiato alcun dato.',
    unreadable: 'Staging non riesce a leggere un’impostazione Beta cifrata. Beta resta invariato. Riavvia per riprovare o iniziare senza copiare.',
    unsafe: 'I dati Beta contengono un collegamento simbolico e non sono stati copiati. Beta resta invariato.',
    interrupted: 'La copia Beta è stata interrotta. Beta resta invariato. Riavvia Staging per ripristinare o iniziare senza copiare.',
    copyFailed: 'Impossibile copiare il profilo Beta. Beta resta invariato. Riavvia per riprovare o iniziare senza copiare.',
    fresh: 'Avvia Staging senza copiare', retryLater: 'Esci e riprova più tardi', copy: 'Copia dati Beta', quitLater: 'Esci e decidi più tardi',
    found: 'È stato trovato un profilo Bespok3d Beta. Chiudi Beta prima di copiare. Staging copierà impostazioni, stampanti, chiavi e dati dell’app in un profilo separato. Beta resta intatto; i dati Staging esistenti non verranno uniti né sovrascritti.',
    partial: 'Una copia Beta precedente è stata interrotta. Beta resta intatto. Riprova, elimina solo la copia Staging incompleta e riparti da zero, oppure esci.',
    retry: 'Riprova copia Beta', discardFresh: 'Elimina la copia incompleta e riparti', openStaging: 'Apri Staging',
    conflict: 'Staging contiene già dati dell’app. Beta non verrà unito né usato per sovrascrivere questo profilo.',
  },
  ko: {
    title: 'Bespok3d Staging', closeBeta: 'Bespok3d Beta를 닫고 Staging을 다시 실행하세요. 프로필은 변경되지 않았습니다.',
    cannotCheck: 'Bespok3d Beta가 닫혔는지 확인할 수 없습니다. 프로필 데이터를 복사하지 않았습니다.',
    unreadable: 'Staging에서 암호화된 Beta 설정을 읽을 수 없습니다. Beta는 그대로 유지됩니다. 다시 실행해 재시도하거나 새로 시작하세요.',
    unsafe: 'Beta 프로필 데이터에 심볼릭 링크가 있어 복사하지 않았습니다. Beta는 그대로 유지됩니다.',
    interrupted: 'Beta 복사가 중단되었습니다. Beta는 그대로 유지됩니다. Staging을 다시 실행해 복구하거나 새로 시작하세요.',
    copyFailed: 'Beta 프로필을 복사하지 못했습니다. Beta는 그대로 유지됩니다. 다시 실행해 재시도하거나 새로 시작하세요.',
    fresh: '복사하지 않고 Staging 시작', retryLater: '종료하고 나중에 재시도', copy: 'Beta 데이터 복사', quitLater: '종료하고 나중에 결정',
    found: '기존 Bespok3d Beta 프로필을 찾았습니다. 복사 전에 Beta를 닫으세요. 설정, 프린터, 키와 앱 데이터를 별도 프로필로 복사합니다. Beta는 그대로 보존되며 기존 Staging 데이터는 병합하거나 덮어쓰지 않습니다.',
    partial: '이전 Beta 복사가 중단되었습니다. Beta는 그대로 유지됩니다. 재시도하거나 불완전한 Staging 복사본만 버리고 새로 시작하거나 종료하세요.',
    retry: 'Beta 복사 재시도', discardFresh: '불완전한 복사본을 버리고 새로 시작', openStaging: 'Staging 열기',
    conflict: 'Staging에 이미 앱 데이터가 있습니다. Beta를 병합하거나 이 프로필을 덮어쓰지 않습니다.',
  },
  tr: {
    title: 'Bespok3d Staging', closeBeta: 'Bespok3d Beta’yı kapatıp Staging’i yeniden başlatın. Hiçbir profil değiştirilmedi.',
    cannotCheck: 'Bespok3d Beta’nın kapalı olduğu doğrulanamadı. Profil verisi kopyalanmadı.',
    unreadable: 'Staging şifreli bir Beta ayarını okuyamadı. Beta değişmeden kaldı. Yeniden deneyin veya kopyalamadan başlayın.',
    unsafe: 'Beta profil verisinde sembolik bağlantı bulunduğu için kopyalanmadı. Beta değişmeden kaldı.',
    interrupted: 'Beta kopyası yarıda kesildi. Beta değişmeden kaldı. Kurtarmak veya kopyalamadan başlamak için Staging’i yeniden başlatın.',
    copyFailed: 'Beta profili kopyalanamadı. Beta değişmeden kaldı. Yeniden deneyin veya kopyalamadan başlayın.',
    fresh: 'Kopyalamadan Staging’i başlat', retryLater: 'Çık ve daha sonra yeniden dene', copy: 'Beta verilerini kopyala', quitLater: 'Çık ve daha sonra karar ver',
    found: 'Mevcut bir Bespok3d Beta profili bulundu. Kopyalamadan önce Beta’yı kapatın. Staging; ayarları, yazıcıları, anahtarları ve uygulama verilerini ayrı bir profile kopyalar. Beta korunur; mevcut Staging verileri birleştirilmez veya üzerine yazılmaz.',
    partial: 'Önceki Beta kopyası yarıda kesildi. Beta değişmeden kaldı. Yeniden deneyin, yalnızca tamamlanmamış Staging kopyasını silip baştan başlayın veya çıkın.',
    retry: 'Beta kopyasını yeniden dene', discardFresh: 'Eksik kopyayı sil ve baştan başla', openStaging: 'Staging’i aç',
    conflict: 'Staging zaten uygulama verileri içeriyor. Beta birleştirilmeyecek ve bu profilin üzerine yazılmayacak.',
  },
}

type TransitionCopyKey = keyof typeof COPY.en
const LANGUAGE_KEYS = Object.keys(COPY) as Array<keyof typeof COPY>

function configuredLocale(betaProfile: string, systemLocale: string): string {
  try {
    const settings = JSON.parse(readFileSync(join(betaProfile, 'settings.json'), 'utf8'))
    if (typeof settings.uiLocale === 'string' && settings.uiLocale !== 'system') return settings.uiLocale
  } catch {
    return systemLocale
  }

  return systemLocale
}

export function channelTransitionText(
  key: TransitionCopyKey,
  betaProfile: string,
  systemLocale: string,
): string {
  const fullLocale = configuredLocale(betaProfile, systemLocale)
  const locale = LANGUAGE_KEYS.includes(fullLocale as keyof typeof COPY)
    ? fullLocale as keyof typeof COPY
    : fullLocale.split('-')[0]
  const translations = LANGUAGE_KEYS.includes(locale as keyof typeof COPY)
    ? COPY[locale as keyof typeof COPY]
    : COPY.en

  return translations[key] ?? COPY.en[key]
}
