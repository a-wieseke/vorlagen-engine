Attribute VB_Name = "ProjektAPI"
Option Explicit

' Import this module into an XLSM workbook. Projekt_JSON is a named cell
' containing the complete JSON payload, matching the in-app API documentation.
' Credentials are read from the workstation environment, never from the workbook.
Public Sub ProjektPerAPIAnlegen()
    On Error GoTo Failed
    Dim endpoint As String, token As String, payload As String
    endpoint = Environ$("WVE_API_URL")
    token = Environ$("WVE_API_KEY")
    If endpoint = "" Or token = "" Then Err.Raise vbObjectError + 1, , "WVE_API_URL und WVE_API_KEY sind nicht eingerichtet."
    If LCase$(Left$(endpoint, 8)) <> "https://" And Left$(endpoint, 17) <> "http://127.0.0.1:" Then Err.Raise vbObjectError + 2, , "Bitte HTTPS verwenden (lokal ist 127.0.0.1 erlaubt)."
    payload = CStr(ThisWorkbook.Names("Projekt_JSON").RefersToRange.Value2)
    If Len(Trim$(payload)) = 0 Then Err.Raise vbObjectError + 3, , "Projekt_JSON ist leer."
    ' ADODB encodes UTF-8 bytes; skip its BOM for interoperable JSON.
    Dim stream As Object, request As Object, content As Variant
    Set stream = CreateObject("ADODB.Stream")
    stream.Type = 2: stream.Charset = "utf-8": stream.Open
    stream.WriteText payload: stream.Position = 0: stream.Type = 1: stream.Position = 3
    content = stream.Read: stream.Close
    Set request = CreateObject("WinHttp.WinHttpRequest.5.1")
    request.SetTimeouts 10000, 10000, 10000, 30000
    request.Open "POST", endpoint, False
    request.Option(6) = False ' Never forward a credential through redirects.
    request.SetRequestHeader "Content-Type", "application/json; charset=utf-8"
    request.SetRequestHeader "Authorization", "Bearer " & token
    ' Optional Cloudflare Access service-token headers, if configured there.
    If Environ$("WVE_CF_CLIENT_ID") <> "" Then
        request.SetRequestHeader "CF-Access-Client-Id", Environ$("WVE_CF_CLIENT_ID")
        request.SetRequestHeader "CF-Access-Client-Secret", Environ$("WVE_CF_CLIENT_SECRET")
    End If
    request.Send content
    If request.Status = 201 Then
        MsgBox "Projekt erfolgreich angelegt.", vbInformation
    Else
        MsgBox "Projekt wurde nicht erneut angelegt. HTTP " & request.Status & vbCrLf & Left$(request.ResponseText, 2000), vbExclamation
    End If
    Exit Sub
Failed:
    MsgBox "Uebertragung fehlgeschlagen: " & Err.Description, vbExclamation
End Sub
