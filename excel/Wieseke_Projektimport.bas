Attribute VB_Name = "Wieseke_Projektimport"
Option Explicit

' Fester lokaler Einstieg. Die Webanwendung muss zuvor über start_windows.bat laufen.
Private Const APP_IMPORT_URL As String = "http://127.0.0.1:8877/excel-import"

Public Sub ProjektAnVorlagenEngine()
    Dim projectJson As String
    projectJson = BuildProjectJson()
    If Len(projectJson) = 0 Then Exit Sub

    If Not CopyTextToClipboard(projectJson) Then
        MsgBox "Die Projektdaten konnten nicht in die Zwischenablage kopiert werden.", vbExclamation
        Exit Sub
    End If

    ThisWorkbook.FollowHyperlink Address:=APP_IMPORT_URL, NewWindow:=True
    MsgBox "Die Projektdaten liegen in der Zwischenablage. Klicken Sie im Browser auf 'Daten aus Zwischenablage einlesen'.", vbInformation
End Sub

Private Function BuildProjectJson() As String
    Dim projectId As String, projectName As String
    projectId = NamedValue("Projekt_ID")
    projectName = NamedValue("Projekt_Bezeichnung")
    If Len(projectId) = 0 Or Len(projectName) = 0 Then
        MsgBox "Die benannten Bereiche Projekt_ID und Projekt_Bezeichnung müssen ausgefüllt sein.", vbExclamation
        Exit Function
    End If

    BuildProjectJson = "{" & _
        """schema_version"":""1.0""," & _
        """projekt"":{" & _
            JsonPair("id", projectId) & "," & _
            JsonPair("bezeichnung", projectName) & "," & _
            JsonPair("fahrzeugtyp", NamedValue("Projekt_Fahrzeugtyp")) & "," & _
            JsonPair("status", NamedValue("Projekt_Status")) & _
        "}," & _
        """auftraggeber"":{" & _
            JsonPair("name", NamedValue("Auftraggeber_Name")) & "," & _
            JsonPair("strasse", NamedValue("Auftraggeber_Strasse")) & "," & _
            JsonPair("plz", NamedValue("Auftraggeber_PLZ")) & "," & _
            JsonPair("ort", NamedValue("Auftraggeber_Ort")) & _
        "}," & _
        """kontakte"":" & BuildContactsJson() & _
    "}"
End Function

Private Function BuildContactsJson() As String
    Dim sheet As Worksheet, table As ListObject, row As ListRow
    Dim result As String, item As String
    result = "["
    For Each sheet In ThisWorkbook.Worksheets
        On Error Resume Next
        Set table = sheet.ListObjects("tblKontakte")
        On Error GoTo 0
        If Not table Is Nothing Then Exit For
    Next sheet

    If Not table Is Nothing Then
        For Each row In table.ListRows
            item = "{" & _
                JsonPair("rolle", TableValue(table, row, "Rolle")) & "," & _
                JsonPair("anrede", TableValue(table, row, "Anrede")) & "," & _
                JsonPair("vorname", TableValue(table, row, "Vorname")) & "," & _
                JsonPair("nachname", TableValue(table, row, "Nachname")) & "," & _
                JsonPair("email", TableValue(table, row, "E-Mail")) & "," & _
                JsonPair("telefon", TableValue(table, row, "Telefon")) & "}"
            If Len(result) > 1 Then result = result & ","
            result = result & item
        Next row
    End If
    BuildContactsJson = result & "]"
End Function

Private Function NamedValue(ByVal rangeName As String) As String
    On Error Resume Next
    NamedValue = CStr(ThisWorkbook.Names(rangeName).RefersToRange.Value)
    On Error GoTo 0
End Function

Private Function TableValue(ByVal table As ListObject, ByVal row As ListRow, ByVal columnName As String) As String
    On Error Resume Next
    TableValue = CStr(row.Range.Cells(1, table.ListColumns(columnName).Index).Value)
    On Error GoTo 0
End Function

Private Function JsonPair(ByVal key As String, ByVal value As String) As String
    JsonPair = """" & JsonEscape(key) & """:""" & JsonEscape(value) & """"
End Function

Private Function JsonEscape(ByVal value As String) As String
    value = Replace(value, "\", "\\")
    value = Replace(value, """", "\""")
    value = Replace(value, vbCrLf, "\n")
    value = Replace(value, vbCr, "\n")
    value = Replace(value, vbLf, "\n")
    JsonEscape = value
End Function

Private Function CopyTextToClipboard(ByVal value As String) As Boolean
    On Error GoTo ClipboardError
    Dim dataObject As Object
    Set dataObject = CreateObject("Forms.DataObject.1")
    dataObject.SetText value
    dataObject.PutInClipboard
    CopyTextToClipboard = True
    Exit Function
ClipboardError:
    CopyTextToClipboard = False
End Function
