import importlib.util
from pathlib import Path
import unittest
import io
import json
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('daily', Path(__file__).parents[1] / 'scripts/daily_fallback.py')
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)

class PublicationTests(unittest.TestCase):
    def item(self):
        return daily.template_item({'t': '거래 관련 기사', 'link': 'https://example.com/news', 'src': '매체'})

    def test_fallback_discloses_headline_and_interpretation(self):
        item = self.item()
        self.assertTrue(daily.valid(item))
        self.assertEqual(item['summaryMode'], 'headline')
        self.assertIn('기사 제목에서 확인', item['sum'][0])

    def test_rejects_broken_markers_and_bad_checks(self):
        for summary, checks in [(['[[정상]] [[누락'], [{'hi': False, 't': '점검'}]),
                                (['[[정상]]'], [{'hi': 'false', 't': '점검'}]),
                                (['[[정상]]'], [{'hi': False, 't': ' '}])]:
            self.assertFalse(daily.valid({'sum': summary, 'checks': checks}))

    def test_rejects_partial_duplicate_and_unsafe_publication(self):
        with self.assertRaises(ValueError):
            daily.validate_document({'items': [self.item()]})
        with self.assertRaises(ValueError):
            daily.validate_document({'items': [self.item() for _ in range(3)]})
        items = [dict(self.item(), title=str(i)) for i in range(3)]
        daily.validate_document({'items': items})
        items[0]['url'] = 'javascript:alert(1)'
        with self.assertRaises(ValueError):
            daily.validate_document({'items': items})

    def test_ai_retries_invalid_shape_and_uses_schema(self):
        good = {'sum': ['제목 기반으로 [[점검]]해요.'], 'checks': [{'hi': False, 't': '확인해 보세요.'}]}
        def response(value):
            return io.BytesIO(json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(value)}]}}]}).encode())
        requests = []
        def urlopen(request, timeout):
            requests.append(json.loads(request.data))
            return response([{'sum':'문자열 응답', 'checks':[]}]) if len(requests)==1 else response([good])
        with patch.dict(daily.os.environ, {'GEMINI_API_KEY':'test-key'}), patch.object(daily.urllib.request,'urlopen',side_effect=urlopen):
            result = daily.ai_items([{'t':'기사 제목','src':'매체'}])
        self.assertEqual(result, [good])
        self.assertEqual(len(requests), 2)
        self.assertEqual(requests[0]['generationConfig']['responseJsonSchema']['items']['properties']['sum']['type'], 'array')

if __name__ == '__main__':
    unittest.main()
