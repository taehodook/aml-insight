import importlib.util
from pathlib import Path
import unittest

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

if __name__ == '__main__':
    unittest.main()
